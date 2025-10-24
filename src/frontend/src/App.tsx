import { useState } from 'react'

import './App.css'
import { DashboardPage } from './pages/Dashboard'
import { LoginPage } from './pages/Login'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem('rad_token')),
  )

  return (
    <div className="app-shell">
      {isAuthenticated ? (
        <DashboardPage />
      ) : (
        <LoginPage onSuccess={() => setIsAuthenticated(true)} />
      )}
    </div>
  )
}

export default App
