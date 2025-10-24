import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { z } from 'zod'

import './Dashboard.css'
import { fetchMetrics } from '../lib/api'
import { MetricsSocket } from '../lib/ws'

const metricSchema = z.object({
  timestamp: z.string(),
  value: z.number(),
  type: z.string(),
})

type MetricPoint = z.infer<typeof metricSchema>

export function DashboardPage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('rad_token')

  useEffect(() => {
    if (!token) {
      navigate('/')
    }
  }, [navigate, token])

  const { data } = useQuery({
    queryKey: ['metrics', 'cpu'],
    queryFn: () => fetchMetrics({ type: 'cpu' }),
    staleTime: 5_000,
  })

  const [realtimePoint, setRealtimePoint] = useState<MetricPoint | null>(null)

  useEffect(() => {
    const socket = new MetricsSocket('cpu', (event) => {
      try {
        const parsed = metricSchema.parse(JSON.parse(event.data))
        setRealtimePoint(parsed)
      } catch (error) {
        console.warn('WS payload parse error', error)
      }
    })
    socket.connect()
    return () => socket.disconnect()
  }, [])

  const chartData = useMemo(() => {
    const base = data?.series ?? []
    return realtimePoint ? [...base, realtimePoint] : base
  }, [data?.series, realtimePoint])

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

      <section className="dashboard-chart">
        <h2>CPU Usage</h2>
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={chartData} margin={{ left: 16, right: 16, top: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" minTickGap={48} tick={{ fontSize: 12 }} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="#67e8f9" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}
