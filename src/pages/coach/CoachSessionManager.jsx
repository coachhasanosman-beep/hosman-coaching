import { useEffect, useState } from 'react'
import { format, addWeeks } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

async function sendCalendarInvite(session, clientEmail, clientName, cancelled = false) {
  try {
    const { data: { session: authSession } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-calendar-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession.access_token}`
      },
      body: JSON.stringify({ session, clientEmail, clientName, cancelled })
    })
  } catch (e) {
    console.error('Calendar invite failed:', e)
  }
}

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

export default function CoachSessionManager({ clientId, client }) {
  const { profile } = useAuth()
  const [pkg, setPkg]       = useState(null)
  const [sessions, setSessions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showPkg, setShowPkg]   = useState(false)
  const [form, setForm] = useState({
    title: 'Session with Hasan',
    location: '',
    date: '',
    time: '10:00',
    duration: 60,
    repeat: false,
    repeatWeeks: 4
  })
  const [pkgForm, setPkgForm] = useState({ sessions_total: '', price_paid: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [clientId])

  async function load() {
    const [pkgRes, sessRes] = await Promise.all([
      supabase.from('packages').select('*').eq('client_id', clientId).order('purchased_at', { ascending: false }).limit(1),
      supabase.from('scheduled_sessions').select('*').eq('client_id', clientId).order('starts_at', { ascending: false }).limit(30)
    ])
    setPkg(pkgRes.data?.[0] || null)
    setSessions(sessRes.data || [])
  }

  async function adjustSessions(delta) {
    if (pkg) {
      const newUsed = pkg.sessions_used + delta
      await supabase.from('packages').update({ sessions_used: newUsed }).eq('id', pkg.id)
    } else {
      await supabase.from('packages').insert({
        client_id: clientId,
        sessions_total: 0,
        sessions_used: delta > 0 ? delta : 0,
        price_paid: null
      })
    }
    load()
  }

  async function addSession() {
    if (!form.date) return toast.error('Date required')
    setSaving(true)
    try {
      const weeks = form.repeat ? parseInt(form.repeatWeeks) : 1
      const baseDate = new Date(`${form.date}T${form.time}`)

      for (let i = 0; i < weeks; i++) {
        const starts_at = addWeeks(baseDate, i).toISOString()
        const { data } = await supabase.from('scheduled_sessions').insert({
          client_id: clientId,
          title: form.title,
          location: form.location,
          starts_at,
          duration_min: form.duration,
          type: 'coached',
          status: 'scheduled',
          created_by: profile.id
        }).select().single()

        await sendCalendarInvite(data, client.email, client.full_name, false)
      }

      toast.success(form.repeat
        ? `${weeks} sessions scheduled — calendar invites sent`
        : 'Session scheduled — calendar invite sent'
      )
      setShowForm(false)
      setForm({ title: 'Session with Hasan', location: '', date: '', time: '10:00', duration: 60, repeat: false, repeatWeeks: 4 })
      load()
    } catch (e) {
      toast.error('Failed to schedule')
    } finally {
      setSaving(false)
    }
  }

  async function markComplete(id) {
    await supabase.from('scheduled_sessions').update({ status: 'completed' }).eq('id', id)

    let newRemaining = -1
    if (pkg) {
      const newUsed = pkg.sessions_used + 1
      await supabase.from('packages').update({ sessions_used: newUsed }).eq('id', pkg.id)
      newRemaining = pkg.sessions_total - newUsed
    }

    const { data: { session: authSession } } = await supabase.auth.getSession()
    await sendThresholdEmail(
      import.meta.env.VITE_SUPABASE_URL,
      authSession.access_token,
      client.email,
      client.full_name,
      newRemaining,
      pkg?.sessions_total || 1
    )

    toast.success('Session marked complete')
    load()
  }

  async function undoComplete(id) {
    await supabase.from('scheduled_sessions').update({ status: 'scheduled' }).eq('id', id)
    if (pkg) {
      const newUsed = pkg.sessions_used - 1
      await supabase.from('packages').update({ sessions_used: newUsed }).eq('id', pkg.id)
    }
    toast.success('Session restored')
    load()
  }

  async function cancelSession(id) {
    const sess = sessions.find(s => s.id === id)
    await supabase.from('scheduled_sessions').update({ status: 'cancelled' }).eq('id', id)
    if (sess) await sendCalendarInvite(sess, client.email, client.full_name, true)
    toast.success('Session cancelled — client notified')
    load()
  }

  async function addPackage() {
    if (!pkgForm.sessions_total || parseInt(pkgForm.sessions_total) < 1) {
      return toast.error('Enter number of sessions')
    }
    setSaving(true)
    try {
      await supabase.from('packages').insert({
        client_id: clientId,
        sessions_total: parseInt(pkgForm.sessions_total),
        sessions_used: 0,
        price_paid: pkgForm.price_paid ? parseFloat(pkgForm.price_paid) : null
      })
      toast.success(`${pkgForm.sessions_total} sessions added`)
      setPkgForm({ sessions_total: '', price_paid: '' })
      setShowPkg(false)
      load()
    } catch (e) {
      toast.error('Failed')
    } finally {
      setSaving(false)
    }
  }

  const remaining = pkg ? pkg.sessions_total - pkg.sessions_used : 0
  const total = pkg?.sessions_total || 0
  const pct = total > 0 ? Math.max(0, remaining) / total : 0
  const circumference = 2 * Math.PI * 66
  const dash = circumference * pct
  const ringColor = !pkg || remaining <= 0 ? 'var(--red)' : 'var(--gold)'

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>

      {/* Session ring */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 4px' }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="66" fill="none" stroke="var(--surface2)" strokeWidth="12"/>
          {pkg && (
            <circle cx="80" cy="80" r="66" fill="none"
              stroke={ringColor}
              strokeWidth="12"
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 80 80)"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}/>
          )}
          <text x="80" y="88" textAnchor="middle" fontSize="32" fontWeight="500"
            fill={!pkg || remaining <= 0 ? 'var(--red)' : 'var(--text)'}
            fontFamily="Montserrat, sans-serif">{remaining}</text>
        </svg>
      </div>

      {/* Manual adjust buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => adjustSessions(1)} title="Deduct a session"
          style={{ background: 'var(--surface2)', border: '0.5px solid var(--border2)', color: 'var(--text)', cursor: 'pointer', borderRadius: 6, width: 32, height: 32, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          {pkg ? `${pkg.sessions_used} used · ${pkg.sessions_total} total` : 'no package'}
        </span>
        <button onClick={() => adjustSessions(-1)} title="Add back a session"
          style={{ background: 'var(--surface2)', border: '0.5px solid var(--border2)', color: 'var(--text)', cursor: 'pointer', borderRadius: 6, width: 32, height: 32, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>

      {/* Package actions */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="section-label">Package</div>
          <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => setShowPkg(!showPkg)}>
            {showPkg ? 'Cancel' : pkg ? 'Add sessions' : 'Add package'}
          </button>
        </div>

        {showPkg && (
          <div className="card">
            <div style={{ marginBottom: 8 }}>
              <label className="input-label">Number of sessions to add</label>
              <input className="input" type="number" min="1" placeholder="e.g. 3"
                value={pkgForm.sessions_total}
                onChange={e => setPkgForm(f => ({ ...f, sessions_total: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="input-label">Price paid (£) — optional</label>
              <input className="input" type="number" placeholder="e.g. 420"
                value={pkgForm.price_paid}
                onChange={e => setPkgForm(f => ({ ...f, price_paid: e.target.value }))} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={addPackage} disabled={saving}>
              {saving ? 'Saving…' : 'Add sessions'}
            </button>
          </div>
        )}
      </div>

      {/* Schedule session */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="section-label">Sessions</div>
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Schedule session'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="mb-12">
            <label className="input-label">Title</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="mb-12">
            <label className="input-label">Location</label>
            <input className="input" placeholder="e.g. Chelsea Physio Studio" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label className="input-label">Date</label>
              <input className="input" type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Time</label>
              <input className="input" type="time" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Duration (min)</label>
              <input className="input" type="number" value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
            </div>
          </div>

          {/* Repeat toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: form.repeat ? 10 : 14 }}>
            <label className="input-label" style={{ margin: 0 }}>Repeat weekly</label>
            <div
              onClick={() => setForm(f => ({ ...f, repeat: !f.repeat }))}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                background: form.repeat ? 'var(--gold)' : 'var(--surface3)',
                position: 'relative', transition: 'background 0.2s'
              }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: form.repeat ? 18 : 2,
                transition: 'left 0.2s'
              }} />
            </div>
          </div>

          {form.repeat && (
            <div style={{ marginBottom: 14 }}>
              <label className="input-label">Number of weeks (max 52)</label>
              <input className="input" type="number" min="2" max="52"
                value={form.repeatWeeks}
                onChange={e => setForm(f => ({ ...f, repeatWeeks: Math.min(52, Math.max(2, parseInt(e.target.value) || 2)) }))} />
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                This will create {form.repeatWeeks} sessions every week on the same day and time
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-sm" onClick={addSession} disabled={saving}>
            {saving ? 'Saving…' : form.repeat ? `Schedule ${form.repeatWeeks} sessions` : 'Schedule & send invite'}
          </button>
        </div>
      )}

      {sessions.map(s => (
        <div key={s.id} className="sched-item" style={{ marginBottom: 8, cursor: 'default' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 52 }}>
            {format(new Date(s.starts_at), 'd MMM')}
          </div>
          <div className={`sched-dot ${s.type === 'solo' ? 'dot-green' : s.status === 'completed' ? 'dot-muted' : 'dot-gold'}`} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {format(new Date(s.starts_at), 'HH:mm')} {s.location ? `· ${s.location}` : ''} {s.type === 'solo' ? '· Client logged' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {s.status === 'scheduled' && (
              <>
                <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 10px', fontSize: 10 }}
                  onClick={() => markComplete(s.id)}>Done</button>
                <button className="btn btn-danger btn-sm" style={{ width: 'auto', padding: '6px 10px', fontSize: 10 }}
                  onClick={() => cancelSession(s.id)}>Cancel</button>
              </>
            )}
            {s.status === 'completed' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="tag tag-green">Completed</span>
                <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 10px', fontSize: 10 }}
                  onClick={() => undoComplete(s.id)}>Undo</button>
              </div>
            )}
            {s.status === 'cancelled' && <span className="tag tag-muted">Cancelled</span>}
          </div>
        </div>
      ))}
    </div>
  )
}