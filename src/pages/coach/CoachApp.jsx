import { useEffect, useState } from 'react'
import { supabase, signOut } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import CoachClientView      from './CoachClientView'
import CoachOverview        from './CoachOverview'
import CoachCalendar        from './CoachCalendar'
import CoachSessions        from './CoachSessions'
import CoachBookingRequests from './CoachBookingRequests'

export default function CoachApp() {
  const { profile } = useAuth()
  const [clients, setClients]             = useState([])
  const [activeClient, setActive]         = useState(null)
  const [showCalendar, setShowCalendar]   = useState(false)
  const [showOverview, setShowOverview]   = useState(true)
  const [showSessions, setShowSessions]   = useState(false)
  const [showRequests, setShowRequests]   = useState(false)
  const [sidebarOpen, setSidebarOpen]     = useState(true)
  const [loading, setLoading]             = useState(true)
  const [pendingCount, setPendingCount]   = useState(0)

  const isMobile = window.innerWidth < 768

  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
    loadClients()
    loadPendingCount()
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

  async function loadPendingCount() {
    const { count } = await supabase
      .from('booking_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    setPendingCount(count || 0)
  }

  function initials(name) {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  }

  function selectClient(c) {
    setActive(c); setShowCalendar(false); setShowOverview(false)
    setShowSessions(false); setShowRequests(false)
    if (isMobile) setSidebarOpen(false)
  }

  function selectCalendar() {
    setShowCalendar(true); setActive(null); setShowOverview(false)
    setShowSessions(false); setShowRequests(false)
    if (isMobile) setSidebarOpen(false)
  }

  function selectOverview() {
    setShowOverview(true); setShowCalendar(false); setShowSessions(false)
    setShowRequests(false); setActive(null)
    if (isMobile) setSidebarOpen(false)
  }

  function selectSessions() {
    setShowSessions(true); setShowCalendar(false); setShowOverview(false)
    setShowRequests(false); setActive(null)
    if (isMobile) setSidebarOpen(false)
  }

  function selectRequests() {
    setShowRequests(true); setShowCalendar(false); setShowOverview(false)
    setShowSessions(false); setActive(null)
    loadPendingCount()
    if (isMobile) setSidebarOpen(false)
  }

  const navBtn = (active, onClick, icon, label, badge) => (
    <button onClick={onClick}
      className={`client-row ${active ? 'active' : ''}`}
      style={{ marginBottom: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
      <div className="avatar" style={{ background: active ? 'var(--gold-bg)' : 'var(--surface2)', border: active ? '0.5px solid var(--gold-bdr)' : '0.5px solid transparent', position: 'relative' }}>
        <i className={`ti ti-${icon}`} style={{ fontSize: 16, color: active ? 'var(--gold)' : 'var(--text3)' }} />
        {badge > 0 && (
          <div style={{ position: 'absolute', top: -4, right: -4, background: 'var(--red)', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {badge}
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: active ? 'var(--text)' : 'var(--text3)' }}>{label}</div>
    </button>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10 }} />
      )}

      <aside style={{
        width: 240, flexShrink: 0, background: 'var(--bg2)',
        borderRight: '0.5px solid var(--border2)', display: 'flex', flexDirection: 'column',
        padding: '24px 16px', overflowY: 'auto',
        position: isMobile ? 'fixed' : 'relative',
        left: isMobile ? (sidebarOpen ? 0 : -260) : 0,
        top: 0, bottom: 0, zIndex: isMobile ? 20 : 1, transition: 'left 0.25s ease'
      }}>
        <div style={{ marginBottom: 28 }}>
          <div className="brand-label" style={{ fontSize: 15, letterSpacing: '0.18em' }}>HOSMAN</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.1em', marginTop: 2 }}>COACH DASHBOARD</div>
        </div>

        {navBtn(showOverview && !activeClient, selectOverview, 'users', 'All clients', 0)}
        {navBtn(showCalendar, selectCalendar, 'calendar', 'Calendar', 0)}
        {navBtn(showSessions, selectSessions, 'list-check', 'Sessions', 0)}
        {navBtn(showRequests, selectRequests, 'calendar-question', 'Requests', pendingCount)}

        <div className="section-label mb-8" style={{ marginTop: 8 }}>Clients</div>

        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>Loading…</div>
        ) : (
          clients.map(c => (
            <div key={c.id}
              className={`client-row ${activeClient?.id === c.id ? 'active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => selectClient(c)}>
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

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: '0.5px solid var(--border2)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{profile?.full_name}</div>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await signOut() }}>Sign out</button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '28px 32px', display: 'flex', flexDirection: 'column' }}>
        {isMobile && (
          <button onClick={() => setSidebarOpen(true)}
            style={{ background: 'var(--surface2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.06em', marginBottom: 16, width: 'fit-content' }}>
            <i className="ti ti-menu-2" style={{ fontSize: 16 }} /> MENU
          </button>
        )}

        {showCalendar
          ? <CoachCalendar clients={clients} />
          : showSessions
            ? <CoachSessions clients={clients} onSelectClient={selectClient} />
            : showRequests
              ? <CoachBookingRequests clients={clients} />
              : activeClient
                ? <CoachClientView client={activeClient} onBack={() => { setActive(null); setShowOverview(true) }} />
                : <CoachOverview clients={clients} onSelectClient={selectClient} onClientsUpdated={loadClients} />
        }
      </main>
    </div>
  )
}