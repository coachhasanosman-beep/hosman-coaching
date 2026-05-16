import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase, signIn, signInWithGoogle, signInWithApple } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState('signin') // 'signin' | 'reset'
  const navigate = useNavigate()

  async function handleSignIn(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(email, password)
      // redirect handled by AppRoutes
    } catch (err) {
      toast.error(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`
      })
      if (error) throw error
      toast.success('Reset link sent — check your email')
      setMode('signin')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px 24px',
      background: 'var(--bg)'
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="brand-label" style={{ fontSize: 16, letterSpacing: '0.22em' }}>HOSMAN</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.14em', marginTop: 4 }}>PREMIUM COACHING</div>
        </div>

        {mode === 'signin' ? (
          <form onSubmit={handleSignIn}>
            <div className="mb-12">
              <label className="input-label">Email</label>
              <input className="input" type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="mb-16">
              <label className="input-label">Password</label>
              <input className="input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary mb-12" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.06em' }}>OR</span>
            </div>
            <button type="button" className="btn btn-ghost mb-8" onClick={signInWithApple}>
              Continue with Apple
            </button>
            <button type="button" className="btn btn-ghost mb-16" onClick={signInWithGoogle}>
              Continue with Google
            </button>
            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={() => setMode('reset')}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', letterSpacing: '0.04em' }}>
                Forgot password?
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              Enter your email and we'll send a reset link
            </p>
            <div className="mb-16">
              <label className="input-label">Email</label>
              <input className="input" type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button className="btn btn-primary mb-12" type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode('signin')}>Back</button>
          </form>
        )}
      </div>
    </div>
  )
}
