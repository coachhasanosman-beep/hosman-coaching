import { useEffect, useState } from 'react'
import { format } from 'date-fns'
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

export default function CoachSessionManager({ clientId, client }) {
  const { profile } = useAuth()
  const [pkg, setPkg]     = useState(null)
  const [sessions, setSessions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showPkg, setShowPkg]   = useState(false)
  const [form, setForm] = useState({ title: 'Session with Hasan', location: '', date: '', time: '10:00', duration: 60 })
  const [pkgForm, setPkgForm] = useState({ sessions_total: 12, price_paid: '' })
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

  async function addSession() {
    if (!form.date) return toast.error('Date required')
    setSaving(true)
    try {
      const starts_at = new Date(`${form.date}T${form.time}`).toISOString()
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

      // Send calendar invite
      await sendCalendarInvite(data, client.email, client.full_name, false)

      toast.success('Session scheduled — calendar invite sent')
      setShowForm(false)
      setForm({ title: 'Session with Hasan', location: '', date: '', time: '10:00', duration: 60 })
      load()
    } catch (e) {
      toast.error('Failed to schedule')
    } finally {
      setSaving(false)
    }
  }

  async function markComplete(id) {
    await supabase.from('scheduled_sessions').update({ status: 'completed' }).eq('id', id)
    if (pkg) {
      await supabase.from('packages').update({ sessions_used: pkg.sessions_used + 1 }).eq('id', pkg.id)
    }
    toast.success('Session marked complete')
    load()
  }

  async function cancelSession(id) {
    const sess = sessions.find(s => s.id === id)
    await supabase.from('scheduled_sessions').update({ status: 'cancelled' }).eq('id', id)

    // Send cancellation
    if (sess) await sendCalendarInvite(sess, client.email, client.full_name, true)

    toast.success('Session cancelled — client notified')
    load()
  }

  async function addPackage() {
    setSaving(true)
    try {
      await supabase.from('packages').insert({
        client_id: clientId,
        sessions_total: parseInt(pkgForm.sessions_total),
        sessions_used: 0,
        price_paid: pkgForm.price_paid ? parseFloat(pkgForm.price_paid) : null
      })
      toast.success('Package added')
      setShowPkg(false)
      load()
    } catch (e) {
      toast.error('Failed')
    } finally {
      setSaving(false)
    }
  }

  const remaining = pkg ? pkg.sessions_total - pkg.sessions_used : null

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Package */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="section-label">Package</div>
          <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => setShowPkg(!showPkg)}>
            {showPkg ? 'Cancel' : pkg ? 'Adjust' : 'Add package'}
          </button>
        </div>

        {pkg && !showPkg && (
          <div className="card row">
            <div>
              <h3 style={{ marginBottom: 2 }}>{pkg.sessions_total}-session package</h3>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {pkg.sessions_used} used · {remaining} remaining
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 500, color: remaining <= 3 ? 'var(--red)' : 'var(--text)' }}>{remaining}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>left</div>
            </div>
          </div>
        )}

        {showPkg && (
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="input-label">Sessions</label>
                <select className="input" value={pkgForm.sessions_total}
                  onChange={e => setPkgForm(f => ({ ...f, sessions_total: e.target.value }))}>
                  {[1,12,24,48].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Price paid (£)</label>
                <input className="input" type="number" placeholder="e.g. 1620" value={pkgForm.price_paid}
                  onChange={e => setPkgForm(f => ({ ...f, price_paid: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={addPackage} disabled={saving}>Save package</button>
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
          <button className="btn btn-primary btn-sm" onClick={addSession} disabled={saving}>
            {saving ? 'Saving…' : 'Schedule & send invite'}
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
          <div style={{ display: 'flex', gap: 6 }}>
            {s.status === 'scheduled' && (
              <>
                <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 10px', fontSize: 10 }}
                  onClick={() => markComplete(s.id)}>Done</button>
                <button className="btn btn-danger btn-sm" style={{ width: 'auto', padding: '6px 10px', fontSize: 10 }}
                  onClick={() => cancelSession(s.id)}>Cancel</button>
              </>
            )}
            {s.status === 'completed' && <span className="tag tag-green">Completed</span>}
            {s.status === 'cancelled' && <span className="tag tag-muted">Cancelled</span>}
          </div>
        </div>
      ))}
    </div>
  )
}