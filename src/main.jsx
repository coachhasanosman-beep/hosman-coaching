import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import './styles/global.css'

// Pages
import LoginPage       from './pages/LoginPage'
import AuthCallback    from './pages/AuthCallback'
import ClientApp       from './pages/client/ClientApp'
import CoachApp        from './pages/coach/CoachApp'

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) return <div className="spinner">HOSMAN</div>

  if (!user) return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )

  if (profile?.role === 'coach') return (
    <Routes>
      <Route path="/coach/*" element={<CoachApp />} />
      <Route path="*" element={<Navigate to="/coach" replace />} />
    </Routes>
  )

  return (
    <Routes>
      <Route path="/app/*" element={<ClientApp />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
