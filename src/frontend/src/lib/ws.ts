export type MetricsSocketStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'closed'

export interface MetricsSocketOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  onStatusChange?: (status: MetricsSocketStatus) => void
  onError?: (error: Error) => void
}

const DEFAULT_MAX_RETRIES = 5
const DEFAULT_BASE_DELAY = 1000
const DEFAULT_MAX_DELAY = 10000

export class MetricsSocket {
  private socket: WebSocket | null = null
  private reconnectTimeout: number | null = null
  private attempts = 0
  private manualClose = false
  private readonly metricType: string
  private readonly onMetric: (event: MessageEvent) => void
  private readonly options: Required<
    Pick<MetricsSocketOptions, 'maxRetries' | 'baseDelayMs' | 'maxDelayMs'>
  > & {
    onStatusChange?: (status: MetricsSocketStatus) => void
    onError?: (error: Error) => void
  }

  constructor(
    metricType: string,
    onMetric: (event: MessageEvent) => void,
    options: MetricsSocketOptions = {},
  ) {
    this.metricType = metricType
    this.onMetric = onMetric
    this.options = {
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelayMs: options.baseDelayMs ?? DEFAULT_BASE_DELAY,
      maxDelayMs: options.maxDelayMs ?? DEFAULT_MAX_DELAY,
      onStatusChange: options.onStatusChange,
      onError: options.onError,
    }
  }

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return
    }

    const token = localStorage.getItem('rad_token')
    if (!token) {
      this.handleFailure(new Error('Missing authentication token'))
      return
    }

    this.manualClose = false
    this.clearReconnectTimer()
    this.updateStatus(this.attempts === 0 ? 'connecting' : 'reconnecting')

    const url = new URL(
      import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000/ws/metrics',
    )
    url.searchParams.set('type', this.metricType)
    url.searchParams.set('token', token)

    try {
      this.socket = new WebSocket(url)
    } catch (error) {
      this.handleFailure(
        error instanceof Error ? error : new Error('Socket initialization failed'),
      )
      return
    }

    this.socket.addEventListener('open', this.handleOpen)
    this.socket.addEventListener('message', this.onMetric)
    this.socket.addEventListener('close', this.handleClose)
    this.socket.addEventListener('error', this.handleError)
  }

  disconnect(): void {
    this.manualClose = true
    this.attempts = 0
    this.clearReconnectTimer()
    if (this.socket) {
      this.socket.removeEventListener('open', this.handleOpen)
      this.socket.removeEventListener('message', this.onMetric)
      this.socket.removeEventListener('close', this.handleClose)
      this.socket.removeEventListener('error', this.handleError)
      this.socket.close()
      this.socket = null
    }
    this.updateStatus('closed')
  }

  private handleOpen = (): void => {
    this.attempts = 0
    const token = localStorage.getItem('rad_token')
    if (token) {
      this.socket?.send(JSON.stringify({ type: 'auth', token }))
    }
    this.updateStatus('connected')
  }

  private handleClose = (): void => {
    this.cleanupSocket()
    if (this.manualClose) {
      return
    }
    this.scheduleReconnect()
  }

  private handleError = (): void => {
    this.options.onError?.(new Error('WebSocket error'))
    this.socket?.close()
  }

  private cleanupSocket(): void {
    if (this.socket) {
      this.socket.removeEventListener('open', this.handleOpen)
      this.socket.removeEventListener('message', this.onMetric)
      this.socket.removeEventListener('close', this.handleClose)
      this.socket.removeEventListener('error', this.handleError)
      this.socket = null
    }
  }

  private scheduleReconnect(): void {
    if (this.attempts >= this.options.maxRetries) {
      this.handleFailure(new Error('Max reconnection attempts reached'))
      return
    }

    this.attempts += 1
    this.updateStatus('reconnecting')

    const delay = Math.min(
      this.options.baseDelayMs * 2 ** (this.attempts - 1),
      this.options.maxDelayMs,
    )

    this.clearReconnectTimer()
    this.reconnectTimeout = window.setTimeout(() => this.connect(), delay)
  }

  private handleFailure(error: Error): void {
    this.updateStatus('failed')
    this.options.onError?.(error)
    this.cleanupSocket()
    this.clearReconnectTimer()
  }

  private updateStatus(status: MetricsSocketStatus): void {
    this.options.onStatusChange?.(status)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }
}
