import axios from 'axios'

type MethodsWithoutBody = 'get' | 'delete'
type MethodsWithBody = 'post' | 'put' | 'patch'
export type HttpMethod = MethodsWithoutBody | MethodsWithBody

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('rad_token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem('rad_token')
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.replace('/')
      }
    }
    return Promise.reject(error)
  },
)

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export const login = async (
  payload: LoginPayload,
): Promise<LoginResponse> => {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload)
  return data
}

export interface MetricPoint {
  timestamp: string
  value: number
  type: string
}

export interface MetricSeriesResponse {
  series: MetricPoint[]
}

export const fetchMetrics = async (
  params: { type: string; from?: string; to?: string } = { type: 'cpu' },
): Promise<MetricSeriesResponse> => {
  const { data } = await apiClient.get<MetricSeriesResponse>('/metrics', {
    params,
  })
  return data
}
