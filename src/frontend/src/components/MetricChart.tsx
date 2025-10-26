import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { MetricPoint } from '../lib/api'
import type { MetricsSocketStatus } from '../lib/ws'

const STATUS_META: Record<
  MetricsSocketStatus,
  { label: string; theme: 'muted' | 'success' | 'warning' | 'error' }
> = {
  idle: { label: '待機中', theme: 'muted' },
  connecting: { label: '接続中…', theme: 'muted' },
  connected: { label: '接続済み', theme: 'success' },
  reconnecting: { label: '再接続中…', theme: 'warning' },
  failed: { label: '接続失敗', theme: 'error' },
  closed: { label: '切断', theme: 'muted' },
}

type MetricChartProps = {
  title: string
  metricType: string
  series: MetricPoint[]
  realtimePoint: MetricPoint | null
  isLoading: boolean
  connectionStatus: MetricsSocketStatus
}

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return timestamp
  }
  return date.toLocaleTimeString()
}

export function MetricChart({
  title,
  metricType,
  series,
  realtimePoint,
  isLoading,
  connectionStatus,
}: MetricChartProps) {
  const chartData = useMemo(() => {
    const merged = new Map<string, MetricPoint>()

    series.forEach((point) => merged.set(point.timestamp, point))

    if (realtimePoint && realtimePoint.type === metricType) {
      merged.set(realtimePoint.timestamp, realtimePoint)
    }

    return Array.from(merged.values())
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
      .map((point) => ({
        ...point,
        value: Number.isFinite(point.value) ? point.value : null,
      }))
  }, [metricType, realtimePoint, series])

  const latestPoint = chartData.at(-1)
  const latestValue =
    typeof latestPoint?.value === 'number'
      ? latestPoint.value.toFixed(1)
      : '--'

  const statusMeta = STATUS_META[connectionStatus] ?? STATUS_META.idle

  return (
    <article className="metric-card">
      <header className="metric-card__header">
        <div>
          <h2 className="metric-card__title">{title}</h2>
          <p className="metric-card__subtitle">
            最新値: <strong>{latestValue}</strong>{' '}
            {latestPoint?.timestamp ? ` (${formatTimestamp(latestPoint.timestamp)})` : ''}
          </p>
        </div>
        <span
          className={`metric-card__status metric-card__status--${statusMeta.theme}`}
        >
          {statusMeta.label}
        </span>
      </header>

      <div className="metric-card__body">
        {isLoading ? (
          <div className="metric-card__loader" role="status" aria-live="polite">
            読み込み中…
          </div>
        ) : chartData.length === 0 ? (
          <div className="metric-card__empty">表示できるデータがありません。</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
            >
              <defs>
                <linearGradient id={`metric-gradient-${metricType}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#0369a1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5f5" />
              <XAxis
                dataKey="timestamp"
                minTickGap={48}
                tick={{ fontSize: 12, fill: '#334155' }}
                tickFormatter={formatTimestamp}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 12, fill: '#334155' }}
                width={70}
              />
              <Tooltip
                cursor={{ stroke: '#94a3b8', strokeDasharray: '6 3' }}
                labelFormatter={formatTimestamp}
                formatter={(
                  value: number | string | (number | string)[] | null | undefined,
                ) => {
                  const displayValue = Array.isArray(value)
                    ? value[0]
                    : value
                  if (typeof displayValue === 'number') {
                    return [displayValue.toFixed(2), title]
                  }
                  return [displayValue ?? '--', title]
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#0284c7"
                strokeWidth={2}
                fill={`url(#metric-gradient-${metricType})`}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0f172a"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </article>
  )
}
