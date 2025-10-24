import { useCallback, useState } from 'react'

import type { LoginPayload } from '../lib/api'
import { login } from '../lib/api'

export interface AuthState {
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export function useAuth(): {
  auth: AuthState
  signIn: (credentials: LoginPayload) => Promise<boolean>
} {
  const [auth, setAuth] = useState<AuthState>({
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  })

  const signIn = useCallback(async (credentials: LoginPayload) => {
    setAuth((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const result = await login(credentials)
      localStorage.setItem('rad_token', result.access_token)
      setAuth({
        token: result.access_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
      return true
    } catch (error) {
      setAuth({
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }, [])

  return { auth, signIn }
}
