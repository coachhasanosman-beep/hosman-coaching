import { useEffect, useState } from 'react'
import { format, isPast, isFuture } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

async function sendThresholdEmail(supabaseUrl, authToken, clientEmail, clientName, remaining, packageSize) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/session-threshold-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ clientEmail, clientName, remaining, packageSize })
    })
  } catch (e) {
    console.error('Threshold email failed:', e)
  }
}

export default function CoachSessions({ onSelectClient, clients }) {
  const [tab, setTab]         = useState('upcoming')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSessions() }, [])

  async function loadSessions() {
    setLoading(true)
    const { data } = await supabase
      .from('scheduled_sessions')
      .select('*, profiles:client_id(id, full_name, email)')
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true })
    setSessions(data || [])
    setLoading(false)
  }

  async function markComplete(session) {
    await supabase.from('scheduled_sessions').update({ status: 'completed' }).eq('id', session.id)

    // Get client package
    const { data: pkg } = await supabase
      .from('packages')
      .select('*')
      .eq('client_id', session.client_id)
      .order('purchased_at', { ascending: false })
      .limit(1)
      .single()

    let newRemaining = -1
    if (pkg) {
      const newUsed = pkg.sessions_used + 1
      await supabase.from('packages').update({ sessions_used: newUsed }).eq('id', pkg.id)
      newRemaining = pkg.sessions_total - newUsed
    }

    // Send threshold email
    const { data: { session: authSession } } = await supabase.auth.getSession()
    const clientEmail = session.profiles?.email
    const clientName = session.profiles?.full_name
    if (clientEmail) {
      await sendThresholdEmail(
        import.meta.env.VITE_SUPABASE_URL,
        authSession.access_token,
        clientEmail,
        clientName,
        newRemaining,
        pkg?.sessions_total || 1
      )
    }

    toast.success('Session marked complete')
    loadSessions()
  }

  async function undoComplete(session) {
    await supabase.from('scheduled_sessions').update({ status: 'scheduled' }).eq('id', session.id)

    const { data: pkg } = await supabase
      .from('packages')
      .select('*')
      .eq('client_id', session.client_id)
      .order('purchased_at', { ascending: false })
      .limit(1)
      .single()

    if (pkg) {
      await supabase.from('packages').update({ sessions_used: pkg.sessions_used - 1 }).eq('id', pkg.id)
    }

    toast.success('Session restored')
    loadSessions()
  }

  const upcoming = sessions.filter(s => s.status === 'scheduled' && isFuture(new Date(s.starts_at)))
  const past = sessions.filter(s => s.status === 'completed' || (s.status === 'scheduled' && isPast(new Date(s.starts_at))))

  const displayed = tab === 'upcoming' ? upcoming : past.reverse()

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Sessions</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>All sessions across every client</div>
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ padding: 0, marginBottom: 20 }}>
        <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming ({upcoming.length})
        </button>
        <button className={`tab-btn ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
          Past ({past.length})
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
      ) : displayed.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
          No {tab} sessions
        </div>
      ) : (
        displayed.map(s => (
          <div key={s.id} className="sched-item" style={{ marginBottom: 8, cursor: 'default' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 52, flexShrink: 0 }}>
              {format(new Date(s.starts_at), 'd MMM')}
            </div>
            <div className={`sched-dot ${s.status === 'completed' ? 'dot-muted' : 'dot-gold'}`} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.profiles?.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {format(new Date(s.starts_at), 'HH:mm')} {s.location ? `· ${s.location}` : ''} · {s.title}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              {s.status === 'scheduled' && (
                <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 10px', fontSize: 10 }}
                  onClick={() => markComplete(s)}>Done</button>
              )}
              {s.status === 'completed' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="tag tag-green">Completed</span>
                  <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 10px', fontSize: 10 }}
                    onClick={() => undoComplete(s)}>Undo</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}