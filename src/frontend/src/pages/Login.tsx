import type { FormEvent } from 'react'
import { useState } from 'react'

import { useAuth } from '../hooks/useAuth'

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('password123')
  const { auth, signIn } = useAuth()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const success = await signIn({ email, password })
    if (success) {
      onSuccess()
    }
  }

  return (
    <div className="login-container">
      <h1>Realtime Analytics Dashboard</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={auth.isLoading}>
          {auth.isLoading ? 'Signing in...' : 'Sign in'}
        </button>
        {auth.error ? <p className="error">{auth.error}</p> : null}
      </form>
    </div>
  )
}
