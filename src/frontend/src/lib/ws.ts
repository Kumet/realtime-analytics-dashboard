export class MetricsSocket {
  private socket: WebSocket | null = null
  private reconnectTimeout: number | null = null
  private readonly metricType: string
  private readonly onMetric: (event: MessageEvent) => void

  constructor(metricType: string, onMetric: (event: MessageEvent) => void) {
    this.metricType = metricType
    this.onMetric = onMetric
  }

  connect(): void {
    const token = localStorage.getItem('rad_token')
    const url = new URL(import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000/ws/metrics')
    url.searchParams.set('type', this.metricType)

    this.socket = new WebSocket(url)

    this.socket.addEventListener('message', this.onMetric)
    this.socket.addEventListener('open', () => {
      if (token) {
        this.socket?.send(JSON.stringify({ token }))
      }
    })
    this.socket.addEventListener('close', () => this.scheduleReconnect())
    this.socket.addEventListener('error', () => this.socket?.close())
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout)
    }
    this.reconnectTimeout = window.setTimeout(() => this.connect(), 2000)
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.socket) {
      this.socket.removeEventListener('message', this.onMetric)
      this.socket.close()
      this.socket = null
    }
  }
}
