import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'

import './Dashboard.css'
import { fetchMetrics, type MetricSeriesResponse } from '../lib/api'
import { MetricChart } from '../components/MetricChart'
import { MetricsSocket, type MetricsSocketStatus } from '../lib/ws'

const metricSchema = z.object({
  timestamp: z.string(),
  value: z.number(),
  type: z.string(),
})

const METRIC_OPTIONS = [
  { value: 'cpu', label: 'CPU 使用率' },
  { value: 'memory', label: 'メモリ使用量' },
  { value: 'disk', label: 'ディスク I/O' },
  { value: 'network', label: 'ネットワーク I/O' },
] as const

const TIME_RANGE_OPTIONS = [
  { value: '5m', label: '過去5分', minutes: 5 },
  { value: '15m', label: '過去15分', minutes: 15 },
  { value: '60m', label: '過去1時間', minutes: 60 },
] as const

type MetricPoint = z.infer<typeof metricSchema>
type TimeRangeValue = (typeof TIME_RANGE_OPTIONS)[number]['value']
type ToastState = { id: number; message: string }

const computeRange = (minutes: number) => {
  const to = new Date()
  const from = new Date(to.getTime() - minutes * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}

const getMetricLabel = (metric: string): string =>
  METRIC_OPTIONS.find((option) => option.value === metric)?.label ?? metric

export function DashboardPage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('rad_token')

  useEffect(() => {
    if (!token) {
      navigate('/')
    }
  }, [navigate, token])

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    METRIC_OPTIONS[0].value,
    METRIC_OPTIONS[1].value,
  ])
  const [timeRange, setTimeRange] = useState<TimeRangeValue>(
    TIME_RANGE_OPTIONS[0].value,
  )
  const [rangeBounds, setRangeBounds] = useState(() =>
    computeRange(TIME_RANGE_OPTIONS[0].minutes),
  )
  const [realtimePoints, setRealtimePoints] = useState<
    Record<string, MetricPoint | null>
  >({})
  const [socketStatuses, setSocketStatuses] = useState<
    Record<string, MetricsSocketStatus>
  >({})
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message })
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const refreshRange = useCallback(() => {
    const minutes =
      TIME_RANGE_OPTIONS.find((option) => option.value === timeRange)?.minutes ??
      TIME_RANGE_OPTIONS[0].minutes
    setRangeBounds(computeRange(minutes))
  }, [timeRange])

  useEffect(() => {
    refreshRange()
  }, [refreshRange])

  useEffect(() => {
    setRealtimePoints((prev) => {
      const next: Record<string, MetricPoint | null> = {}
      selectedMetrics.forEach((metric) => {
        next[metric] = prev[metric] ?? null
      })
      return next
    })
    setSocketStatuses((prev) => {
      const next: Record<string, MetricsSocketStatus> = {}
      selectedMetrics.forEach((metric) => {
        next[metric] = prev[metric] ?? 'idle'
      })
      return next
    })
  }, [selectedMetrics])

  useEffect(() => {
    let mounted = true
    const sockets = selectedMetrics.map((metric) => {
      const socket = new MetricsSocket(
        metric,
        (event) => {
          try {
            const parsed = metricSchema.parse(JSON.parse(event.data))
            if (!mounted || parsed.type !== metric) {
              return
            }
            setRealtimePoints((prev) => ({ ...prev, [metric]: parsed }))
          } catch (error) {
            console.warn('WS payload parse error', error)
            showToast(`${getMetricLabel(metric)} のストリームを解析できませんでした。`)
          }
        },
        {
          maxRetries: 6,
          baseDelayMs: 1200,
          onStatusChange: (status) => {
            if (!mounted) {
              return
            }
            setSocketStatuses((prev) => ({ ...prev, [metric]: status }))
          },
          onError: (error) => {
            if (!mounted) {
              return
            }
            showToast(`${getMetricLabel(metric)} の再接続に失敗しました: ${error.message}`)
          },
        },
      )
      socket.connect()
      return socket
    })

    return () => {
      mounted = false
      sockets.forEach((socket) => socket.disconnect())
    }
  }, [selectedMetrics, showToast])

  const metricQueries = useQueries({
    queries: selectedMetrics.map((metric) => {
      const option = METRIC_OPTIONS.find((item) => item.value === metric)
      return {
        queryKey: ['metrics', metric, rangeBounds.from, rangeBounds.to],
        queryFn: () =>
          fetchMetrics({
            type: metric,
            from: rangeBounds.from,
            to: rangeBounds.to,
          }),
        staleTime: 30_000,
        refetchInterval: 30_000,
        onError: () =>
          showToast(`${option?.label ?? metric} の取得に失敗しました。`),
      }
    }),
  }) as UseQueryResult<MetricSeriesResponse>[]

  const seriesByMetric = useMemo(() => {
    const result: Record<string, MetricPoint[]> = {}
    selectedMetrics.forEach((metric, index) => {
      result[metric] = metricQueries[index]?.data?.series ?? []
    })
    return result
  }, [metricQueries, selectedMetrics])

  const isInitialLoading = metricQueries.some(
    (query) => query?.isLoading ?? false,
  )
  const anyReconnecting = selectedMetrics.some(
    (metric) => socketStatuses[metric] === 'reconnecting',
  )

  const handleMetricToggle = (metric: string) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(metric)) {
        if (prev.length === 1) {
          return prev
        }
        return prev.filter((item) => item !== metric)
      }
      return [...prev, metric]
    })
  }

  const handleRangeChange = (value: TimeRangeValue) => {
    setTimeRange(value)
  }

  const handleRefresh = () => {
    refreshRange()
    metricQueries.forEach((query) => {
      if (query?.refetch) {
        void query.refetch()
      }
    })
  }

  const metricsToRender = selectedMetrics
    .map((metric) => METRIC_OPTIONS.find((option) => option.value === metric))
    .filter((item): item is (typeof METRIC_OPTIONS)[number] => Boolean(item))

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>Realtime Analytics</h1>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('rad_token')
            navigate('/')
          }}
        >
          Logout
        </button>
      </header>

      {toast && (
        <div className="dashboard-toast dashboard-toast--error">{toast.message}</div>
      )}

      <section className="dashboard-controls">
        <div className="dashboard-controls__group">
          <span className="dashboard-controls__label">メトリクス</span>
          <div className="dashboard-controls__options">
            {METRIC_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleMetricToggle(option.value)}
                className={`dashboard-toggle ${
                  selectedMetrics.includes(option.value) ? 'is-active' : ''
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-controls__group">
          <span className="dashboard-controls__label">期間</span>
          <div className="dashboard-controls__options">
            {TIME_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleRangeChange(option.value)}
                className={`dashboard-toggle ${
                  timeRange === option.value ? 'is-active' : ''
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="dashboard-refresh"
          onClick={handleRefresh}
        >
          再読み込み
        </button>
      </section>

      <div className="dashboard-meta">
        <span>
          最終更新: {new Date(rangeBounds.to).toLocaleTimeString()}
        </span>
        {isInitialLoading && (
          <span className="dashboard-meta__loader" role="status" aria-live="polite">
            ローディング中…
          </span>
        )}
        {anyReconnecting && (
          <span className="dashboard-meta__status">
            リアルタイム接続を再試行しています…
          </span>
        )}
      </div>

      <section className="metric-grid">
        {metricsToRender.map((option, index) => (
          <MetricChart
            key={option.value}
            title={option.label}
            metricType={option.value}
            series={seriesByMetric[option.value] ?? []}
            realtimePoint={realtimePoints[option.value] ?? null}
            isLoading={metricQueries[index]?.isLoading ?? false}
            connectionStatus={socketStatuses[option.value] ?? 'idle'}
          />
        ))}
      </section>
    </div>
  )
}
