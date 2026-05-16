import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PACKAGES, createCheckoutSession } from '../../lib/stripe'

export default function SessionsPage({ clientId: propClientId }) {
  const { profile } = useAuth()
  const clientId = propClientId || profile?.id

  const [pkg, setPkg]             = useState(null)
  const [selected, setSelected]   = useState('12')
  const [loading, setLoading]     = useState(true)
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => { if (clientId) load() }, [clientId])

  // Check for successful Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      toast.success('Payment successful — sessions added!')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('packages')
      .select('*')
      .eq('client_id', clientId)
      .order('purchased_at', { ascending: false })
      .limit(1)
    setPkg(data?.[0] || null)
    setLoading(false)
  }

  async function handlePurchase() {
    setPurchasing(true)
    try {
      await createCheckoutSession(selected, clientId)
    } catch (e) {
      toast.error(e.message || 'Payment failed')
      setPurchasing(false)
    }
  }

  const remaining = pkg ? pkg.sessions_total - pkg.sessions_used : 0
  const total     = pkg?.sessions_total || 0
  const pct       = total > 0 ? remaining / total : 0
  const circumference = 2 * Math.PI * 66
  const dash = circumference * pct

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="brand-label">HOSMAN</div>
        <h1>Sessions</h1>
      </div>

      <div className="page-scroll">
        {/* Ring */}
        {pkg && (
          <div className="sessions-ring">
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="66" fill="none" stroke="var(--surface2)" strokeWidth="12"/>
              <circle cx="80" cy="80" r="66" fill="none" stroke="var(--gold)" strokeWidth="12"
                strokeDasharray={`${dash} ${circumference}`}
                strokeLinecap="round" transform="rotate(-90 80 80)"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}/>
              <text x="80" y="72" textAnchor="middle" fontSize="32" fontWeight="500"
                fill="var(--text)" fontFamily="Montserrat, sans-serif">{remaining}</text>
              <text x="80" y="92" textAnchor="middle" fontSize="11"
                fill="var(--text3)" fontFamily="Montserrat, sans-serif">of {total} remaining</text>
            </svg>
          </div>
        )}

        {!loading && !pkg && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, paddingBottom: 20 }}>
            No active package — purchase one below to get started.
          </div>
        )}

        {/* Package selector */}
        <div className="section-label mb-8">Buy sessions</div>

        {PACKAGES.map(p => (
          <div key={p.id}
            className={`pkg-card ${selected === p.id ? 'selected' : ''}`}
            onClick={() => setSelected(p.id)}>
            <div className="row">
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{p.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{p.perSession}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{p.priceDisplay}</div>
                {p.saving && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>{p.saving}</div>}
              </div>
            </div>
          </div>
        ))}

        {/* Policy */}
        <div style={{
          background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
          padding: '12px 14px', marginBottom: 16
        }}>
          {[
            { icon: 'ti-clock', text: '24-hour cancellation policy applies to all sessions' },
            { icon: 'ti-alert-circle', text: 'No refunds on purchased packages' }
          ].map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: i === 0 ? 8 : 0 }}>
              <i className={`ti ${l.icon}`} style={{ fontSize: 13, color: 'var(--text3)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
              <span style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{l.text}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-gold mb-8" onClick={handlePurchase} disabled={purchasing}>
          {purchasing ? 'Redirecting…' : 'Pay with Apple Pay / Card'}
        </button>
        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}
