import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { supabase, signOut, inviteClient } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import CoachClientView from './CoachClientView'
import CoachOverview   from './CoachOverview'

export default function CoachApp() {
  const { profile } = useAuth()
  const [clients, setClients]       = useState([])
  const [activeClient, setActive]   = useState(null)
  const [inviting, setInviting]     = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '' })
  const [loading, setLoading]       = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .order('full_name')
    setClients(data || [])
    setLoading(false)
  }

  async function handleInvite(e) {
    e.preventDefault()
    try {
      await inviteClient(inviteForm.email, inviteForm.name)
      toast.success(`Invite sent to ${inviteForm.email}`)
      setInviteForm({ name: '', email: '' })
      setInviting(false)
      loadClients()
    } catch (err) {
      toast.error(err.message || 'Invite failed')
    }
  }

  function initials(name) {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  }

  const isMobile = window.innerWidth < 768

  return (
    <div className="coach-layout">
      {/* Sidebar */}
      <aside className="coach-sidebar">
        <div style={{ marginBottom: 28 }}>
          <div className="brand-label" style={{ fontSize: 15, letterSpacing: '0.18em' }}>HOSMAN</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.1em', marginTop: 2 }}>COACH DASHBOARD</div>
        </div>

        <div className="section-label mb-8">Clients</div>

        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>Loading…</div>
        ) : (
          clients.map(c => (
            <div key={c.id}
              className={`client-row ${activeClient?.id === c.id ? 'active' : ''}`}
              onClick={() => setActive(c)}>
              <div className="avatar">{initials(c.full_name)}</div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.full_name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{c.email}</div>
              </div>
            </div>
          ))
        )}

        {!inviting ? (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setInviting(true)}>
            <i className="ti ti-user-plus" style={{ fontSize: 14 }} aria-hidden="true" /> Invite client
          </button>
        ) : (
          <form onSubmit={handleInvite} style={{ marginTop: 12 }}>
            <input className="input" placeholder="Full name" value={inviteForm.name}
              onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
              style={{ marginBottom: 8, fontSize: 12, padding: '10px 12px' }} required />
            <input className="input" type="email" placeholder="Email" value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              style={{ marginBottom: 8, fontSize: 12, padding: '10px 12px' }} required />
            <button className="btn btn-primary btn-sm" type="submit" style={{ marginBottom: 6 }}>Send invite</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInviting(false)}>Cancel</button>
          </form>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: '0.5px solid var(--border2)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
            {profile?.full_name}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await signOut() }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main panel */}
      <main className="coach-main">
        {activeClient
          ? <CoachClientView client={activeClient} onBack={() => setActive(null)} />
          : <CoachOverview clients={clients} onSelectClient={setActive} />
        }
      </main>
    </div>
  )
}
