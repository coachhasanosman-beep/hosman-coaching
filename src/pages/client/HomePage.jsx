import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isToday, isTomorrow, differenceInHours } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { scheduleSessionReminders } from '../../lib/notifications'

export default function HomePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [upcoming, setUpcoming]       = useState(null)
  const [sessionsLeft, setSessionsLeft] = useState(null)
  const [metrics, setMetrics]         = useState(null)
  const [programme, setProgramme]     = useState(null)
  const [notifShown, setNotifShown]   = useState(false)

  useEffect(() => {
    if (!profile) return
    loadData()
  }, [profile])

  async function loadData() {
    const uid = profile.id

    // Upcoming session
    const { data: sessions } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('client_id', uid)
      .eq('status', 'scheduled')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(5)

    if (sessions?.length) {
      setUpcoming(sessions[0])
      scheduleSessionReminders(sessions)
      // Show 1hr banner
      const hoursUntil = differenceInHours(new Date(sessions[0].starts_at), new Date())
      if (hoursUntil >= 0 && hoursUntil <= 1) setNotifShown(true)
    }

    // Sessions remaining
    const { data: pkgs } = await supabase
      .from('packages')
      .select('*')
      .eq('client_id', uid)
      .order('purchased_at', { ascending: false })
      .limit(1)

    if (pkgs?.length) {
      const pkg = pkgs[0]
      setSessionsLeft({ remaining: pkg.sessions_total - pkg.sessions_used, total: pkg.sessions_total })
    }

    // Latest metrics
    const { data: met } = await supabase
      .from('metrics')
      .select('*')
      .eq('client_id', uid)
      .order('recorded_at', { ascending: false })
      .limit(1)

    if (met?.length) setMetrics(met[0])

    // Current programme
    const { data: progs } = await supabase
      .from('programmes')
      .select('*')
      .eq('client_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)

    if (progs?.length) setProgramme(progs[0])
  }

  function sessionDateLabel(dateStr) {
    const d = new Date(dateStr)
    if (isToday(d)) return 'Today'
    if (isTomorrow(d)) return 'Tomorrow'
    return format(d, 'EEE d MMM')
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="brand-label">HOSMAN</div>
        <h1>{greeting}, {firstName}</h1>
      </div>
      <div className="page-scroll">

        {/* 1hr notification banner */}
        {notifShown && upcoming && (
          <div className="notif-banner mb-16">
            <i className="ti ti-bell" style={{ color: 'var(--gold)', fontSize: 16, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <span>Your session with Hasan starts in 1 hour — {upcoming.location || ''}, {format(new Date(upcoming.starts_at), 'h:mm a')}</span>
          </div>
        )}

        {/* Low sessions warning */}
        {sessionsLeft && sessionsLeft.remaining <= 3 && (
          <div className="notif-banner mb-16" style={{ borderColor: 'rgba(220,80,80,0.3)', background: 'rgba(220,80,80,0.08)' }}>
            <i className="ti ti-alert-triangle" style={{ color: 'var(--red)', fontSize: 16, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <span style={{ color: 'var(--text)' }}>
              You have <strong>{sessionsLeft.remaining}</strong> session{sessionsLeft.remaining !== 1 ? 's' : ''} remaining.{' '}
              <span style={{ color: 'var(--gold)', cursor: 'pointer' }} onClick={() => navigate('/app/sessions')}>Buy more →</span>
            </span>
          </div>
        )}

        {/* Current programme */}
        {programme && (
          <>
            <div className="section-label mb-8">Current block</div>
            <div className="card mb-16" onClick={() => navigate('/app/programme')} style={{ cursor: 'pointer' }}>
              <div className="row mb-8">
                <div>
                  <h3 style={{ marginBottom: 2 }}>{programme.title}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>6-week block</div>
                </div>
                <i className="ti ti-chevron-right" style={{ color: 'var(--text3)', fontSize: 18 }} aria-hidden="true" />
              </div>
              <span className="tag tag-green">Active</span>
            </div>
          </>
        )}

        {/* Next session */}
        {upcoming && (
          <>
            <div className="section-label mb-8">Next session</div>
            <div className="card mb-16" onClick={() => navigate('/app/schedule')} style={{ cursor: 'pointer' }}>
              <div className="row">
                <div>
                  <h3 style={{ marginBottom: 2 }}>{upcoming.title}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {sessionDateLabel(upcoming.starts_at)} · {format(new Date(upcoming.starts_at), 'h:mm a')}
                    {upcoming.location ? ` · ${upcoming.location}` : ''}
                  </div>
                </div>
                <span className={`tag ${isToday(new Date(upcoming.starts_at)) ? 'tag-gold' : 'tag-muted'}`}>
                  {sessionDateLabel(upcoming.starts_at)}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Sessions remaining */}
        {sessionsLeft !== null && (
          <>
            <div className="section-label mb-8">Sessions remaining</div>
            <div className="card mb-16 row" onClick={() => navigate('/app/sessions')} style={{ cursor: 'pointer' }}>
              <div>
                <h3 style={{ marginBottom: 2 }}>{sessionsLeft.total}-session package</h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 500, color: sessionsLeft.remaining <= 3 ? 'var(--red)' : 'var(--text)' }}>
                  {sessionsLeft.remaining}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>remaining</div>
              </div>
            </div>
          </>
        )}

        {/* Latest metrics */}
        {metrics && (
          <>
            <div className="section-label mb-8">Latest metrics</div>
            <div className="card mb-16" onClick={() => navigate('/app/metrics')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="metric-box">
                  <div className="label">Weight</div>
                  <div className="val">{metrics.weight_kg} <span className="unit">kg</span></div>
                </div>
                <div className="metric-box">
                  <div className="label">Muscle</div>
                  <div className="val">{metrics.smm_kg} <span className="unit">kg</span></div>
                </div>
                <div className="metric-box">
                  <div className="label">Body fat</div>
                  <div className="val">{metrics.body_fat_pct} <span className="unit">%</span></div>
                </div>
              </div>
            </div>
          </>
        )}

        {!upcoming && !sessionsLeft && !metrics && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text3)', fontSize: 13 }}>
            Welcome to HOSMAN Coaching.<br />Your programme will appear here.
          </div>
        )}
      </div>
    </div>
  )
}
