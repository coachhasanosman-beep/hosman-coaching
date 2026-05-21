import { useEffect, useState } from 'react'
import { supabase, signOut, inviteClient } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import CoachClientView from './CoachClientView'
import CoachOverview   from './CoachOverview'
import CoachCalendar   from './CoachCalendar'

export default function CoachApp() {
  const { profile } = useAuth()
  const [clients, setClients]           = useState([])
  const [activeClient, setActive]       = useState(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showOverview, setShowOverview] = useState(true)
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [inviting, setInviting]         = useState(false)
  const [inviteForm, setInviteForm]     = useState({ name: '', email: '' })
  const [loading, setLoading]           = useState(true)

  const isMobile = window.innerWidth < 768

  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
    loadClients()
  }, [])

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

  async function resendWelcome(client) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email: client.email, full_name: client.full_name })
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success(`Welcome email sent to ${client.full_name}`)
    } catch (err) {
      toast.error(err.message || 'Failed to send')
    }
  }

  function initials(name) {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  }

  function selectClient(c) {
    setActive(c)
    setShowCalendar(false)
    setShowOverview(false)
    if (isMobile) setSidebarOpen(false)
  }

  function selectCalendar() {
    setShowCalendar(true)
    setActive(null)
    setShowOverview(false)
    if (isMobile) setSidebarOpen(false)
  }

  function selectOverview() {
    setShowOverview(true)
    setShowCalendar(false)
    setActive(null)
    if (isMobile) setSidebarOpen(false)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: 'var(--bg2)',
        borderRight: '0.5px solid var(--border2)',
        display: 'flex', flexDirection: 'column',
        padding: '24px 16px',
        overflowY: 'auto',
        position: isMobile ? 'fixed' : 'relative',
        left: isMobile ? (sidebarOpen ? 0 : -260) : 0,
        top: 0, bottom: 0,
        zIndex: isMobile ? 20 : 1,
        transition: 'left 0.25s ease'
      }}>
        <div style={{ marginBottom: 28 }}>
          <div className="brand-label" style={{ fontSize: 15, letterSpacing: '0.18em' }}>HOSMAN</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.1em', marginTop: 2 }}>COACH DASHBOARD</div>
        </div>

        {/* All Clients */}
        <button
          onClick={selectOverview}
          className={`client-row ${showOverview && !activeClient && !showCalendar ? 'active' : ''}`}
          style={{ marginBottom: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
          <div className="avatar" style={{
            background: showOverview && !activeClient ? 'var(--gold-bg)' : 'var(--surface2)',
            border: showOverview && !activeClient ? '0.5px solid var(--gold-bdr)' : '0.5px solid transparent'
          }}>
            <i className="ti ti-users" style={{ fontSize: 16, color: showOverview && !activeClient ? 'var(--gold)' : 'var(--text3)' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: showOverview && !activeClient ? 'var(--text)' : 'var(--text3)' }}>All clients</div>
        </button>

        {/* Calendar */}
        <button
          onClick={selectCalendar}
          className={`client-row ${showCalendar ? 'active' : ''}`}
          style={{ marginBottom: 16, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
          <div className="avatar" style={{
            background: showCalendar ? 'var(--gold-bg)' : 'var(--surface2)',
            border: showCalendar ? '0.5px solid var(--gold-bdr)' : '0.5px solid transparent'
          }}>
            <i className="ti ti-calendar" style={{ fontSize: 16, color: showCalendar ? 'var(--gold)' : 'var(--text3)' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: showCalendar ? 'var(--text)' : 'var(--text3)' }}>Calendar</div>
        </button>

        <div className="section-label mb-8">Clients</div>

        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>Loading…</div>
        ) : (
          clients.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                className={`client-row ${activeClient?.id === c.id ? 'active' : ''}`}
                style={{ flex: 1, cursor: 'pointer' }}
                onClick={() => selectClient(c)}>
                <div className="avatar">{initials(c.full_name)}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.full_name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{c.email}</div>
                </div>
              </div>
              <button
                title="Resend welcome email"
                onClick={() => resendWelcome(c)}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '4px', opacity: 0.5, flexShrink: 0 }}>
                <i className="ti ti-mail" style={{ fontSize: 14 }} />
              </button>
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
      <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '28px 32px', display: 'flex', flexDirection: 'column' }}>
        {isMobile && (
          <button onClick={() => setSidebarOpen(true)}
            style={{
              background: 'var(--surface2)', border: '0.5px solid var(--border2)',
              borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat, sans-serif',
              letterSpacing: '0.06em', marginBottom: 16, width: 'fit-content'
            }}>
            <i className="ti ti-menu-2" style={{ fontSize: 16 }} /> MENU
          </button>
        )}

        {showCalendar
          ? <CoachCalendar clients={clients} />
          : activeClient
            ? <CoachClientView client={activeClient} onBack={() => { setActive(null); setShowOverview(true) }} />
            : <CoachOverview clients={clients} onSelectClient={selectClient} />
        }
      </main>
    </div>
  )
}