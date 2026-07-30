import { useEffect, useState } from 'react'
import { format, isToday, isPast, isFuture } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function SchedulePage({ clientId: propClientId }) {
  const { profile } = useAuth()
  const clientId = propClientId || profile?.id

  const [sessions, setSessions]       = useState([])
  const [requests, setRequests]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [showLog, setShowLog]         = useState(false)
  const [showRequest, setShowRequest] = useState(false)
  const [form, setForm]               = useState({ title: '', date: '', time: '', notes: '' })
  const [reqForm, setReqForm]         = useState({ date: '', time: '', duration: 60, notes: '' })
  const [saving, setSaving]           = useState(false)

  useEffect(() => { if (clientId) load() }, [clientId])

  async function load() {
    setLoading(true)
    const [sessRes, reqRes] = await Promise.all([
      supabase.from('scheduled_sessions').select('*').eq('client_id', clientId).order('starts_at', { ascending: false }),
      supabase.from('booking_requests').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    ])
    setSessions(sessRes.data || [])
    setRequests(reqRes.data || [])
    setLoading(false)
  }

  async function logSession() {
    if (!form.title || !form.date) return
    setSaving(true)
    try {
      const starts_at = new Date(`${form.date}T${form.time || '00:00'}`).toISOString()
      await supabase.from('scheduled_sessions').insert({
        client_id: clientId,
        title: form.title,
        starts_at,
        type: 'solo',
        status: 'completed',
        notes: form.notes,
        created_by: profile.id
      })
      toast.success('Session logged')
      setForm({ title: '', date: '', time: '', notes: '' })
      setShowLog(false)
      load()
    } catch (e) {
      toast.error('Failed to log session')
    } finally {
      setSaving(false)
    }
  }

  async function submitRequest() {
  if (!reqForm.date || !reqForm.time) return toast.error('Date and time required')
  setSaving(true)
  try {
    const requested_at = new Date(`${reqForm.date}T${reqForm.time}`).toISOString()
    await supabase.from('booking_requests').insert({
      client_id: clientId,
      requested_at,
      duration_min: parseInt(reqForm.duration),
      notes: reqForm.notes,
      status: 'pending'
    })

    // Notify coach
    const { data: { session: authSession } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-request-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession.access_token}`
      },
      body: JSON.stringify({
        clientName: profile.full_name,
        clientEmail: profile.email,
        requestedAt: requested_at,
        duration: reqForm.duration,
        notes: reqForm.notes
      })
    })

    toast.success('Request sent to your coach')
    setReqForm({ date: '', time: '', duration: 60, notes: '' })
    setShowRequest(false)
    load()
  } catch (e) {
    toast.error('Failed to send request')
  } finally {
    setSaving(false)
  }
}

  function statusTag(s) {
    if (s.status === 'cancelled') return <span className="tag tag-muted">Cancelled</span>
    if (s.status === 'completed') return <span className="tag tag-green">Completed</span>
    if (isToday(new Date(s.starts_at))) return <span className="tag tag-gold">Today</span>
    return <span className="tag tag-muted">Scheduled</span>
  }

  function requestStatusTag(r) {
    if (r.status === 'pending') return <span className="tag tag-gold">Pending</span>
    if (r.status === 'confirmed') return <span className="tag tag-green">Confirmed</span>
    if (r.status === 'declined') return <span className="tag tag-muted">Declined</span>
  }

  const upcoming = sessions.filter(s => s.status === 'scheduled' && isFuture(new Date(s.starts_at)))
  const past     = sessions.filter(s => s.status !== 'scheduled' || isPast(new Date(s.starts_at)))
  const pendingRequests = requests.filter(r => r.status === 'pending')
  const pastRequests = requests.filter(r => r.status !== 'pending')

  function groupByDate(items) {
    const groups = {}
    items.forEach(s => {
      const d = format(new Date(s.starts_at), 'yyyy-MM-dd')
      if (!groups[d]) groups[d] = []
      groups[d].push(s)
    })
    return groups
  }

  function DayGroup({ label, items }) {
    if (!items.length) return null
    return (
      <div style={{ marginBottom: 20 }}>
        <div className="section-label mb-8">{label}</div>
        {items.map(s => (
          <div key={s.id} className="sched-item">
            <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 44 }}>
              {format(new Date(s.starts_at), 'HH:mm')}
            </div>
            <div className={`sched-dot ${s.type === 'solo' ? 'dot-green' : isPast(new Date(s.starts_at)) ? 'dot-muted' : 'dot-gold'}`} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
              {s.location && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{s.location}</div>}
              {s.notes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{s.notes}</div>}
            </div>
            {statusTag(s)}
          </div>
        ))}
      </div>
    )
  }

  const upcomingGroups = groupByDate(upcoming)

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="brand-label">HOSMAN</div>
        <h1>Schedule</h1>
      </div>

      <div className="page-scroll">
        {loading ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div> : (
          <>
            {/* Book a session button */}
            {!showRequest && !showLog && (
              <button className="btn btn-gold mb-20" onClick={() => setShowRequest(true)}>
                <i className="ti ti-calendar-plus" style={{ fontSize: 14 }} />
                Request a session
              </button>
            )}

            {/* Booking request form */}
            {showRequest && (
              <div className="card mb-20">
                <h3 style={{ marginBottom: 14 }}>Request a session</h3>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
                  Your coach will confirm or suggest an alternative time.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label className="input-label">Date</label>
                    <input className="input" type="date" value={reqForm.date}
                      onChange={e => setReqForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">Time</label>
                    <input className="input" type="time" step="900" value={reqForm.time}
                      onChange={e => setReqForm(f => ({ ...f, time: e.target.value }))} />
                  </div>
                </div>
                <div className="mb-12">
                  <label className="input-label">Duration (min)</label>
                  <input className="input" type="number" value={reqForm.duration}
                    onChange={e => setReqForm(f => ({ ...f, duration: e.target.value }))} />
                </div>
                <div className="mb-12">
                  <label className="input-label">Notes (optional)</label>
                  <input className="input" placeholder="Any preferences or requests?" value={reqForm.notes}
                    onChange={e => setReqForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <button className="btn btn-primary mb-8" onClick={submitRequest} disabled={saving}>
                  {saving ? 'Sending…' : 'Send request'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowRequest(false)}>Cancel</button>
              </div>
            )}

            {/* Pending requests */}
            {pendingRequests.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="section-label mb-8">Pending requests</div>
                {pendingRequests.map(r => (
                  <div key={r.id} className="sched-item">
                    <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 44 }}>
                      {format(new Date(r.requested_at), 'HH:mm')}
                    </div>
                    <div className="sched-dot dot-gold" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {format(new Date(r.requested_at), 'EEE d MMM')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {r.duration_min} min{r.notes ? ` · ${r.notes}` : ''}
                      </div>
                    </div>
                    {requestStatusTag(r)}
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming sessions */}
            {Object.entries(upcomingGroups).sort().map(([date, items]) => {
              const d = new Date(date)
              const label = isToday(d) ? 'Today' : format(d, 'EEE d MMM').toUpperCase()
              return <DayGroup key={date} label={label} items={items} />
            })}
            {!upcoming.length && !pendingRequests.length && (
              <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>No upcoming sessions scheduled.</div>
            )}

            {/* Log solo session button */}
            {!showLog && !showRequest && (
              <button className="btn btn-ghost mb-20" onClick={() => setShowLog(true)}>
                <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
                Log a session
              </button>
            )}

            {/* Log form */}
            {showLog && (
              <div className="card mb-20">
                <h3 style={{ marginBottom: 14 }}>Log a session</h3>
                <div className="mb-12">
                  <label className="input-label">Session name</label>
                  <input className="input" placeholder="e.g. Morning run, Solo gym" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label className="input-label">Date</label>
                    <input className="input" type="date" value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="input-label">Time (optional)</label>
                    <input className="input" type="time" value={form.time}
                      onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                  </div>
                </div>
                <div className="mb-12">
                  <label className="input-label">Notes (optional)</label>
                  <input className="input" placeholder="What did you do?" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <button className="btn btn-primary mb-8" onClick={logSession} disabled={saving}>
                  {saving ? 'Saving…' : 'Save session'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowLog(false)}>Cancel</button>
              </div>
            )}

            {/* Past sessions */}
            {past.length > 0 && (
              <DayGroup label="Past sessions" items={past.slice(0, 20)} />
            )}

            {/* Past requests */}
            {pastRequests.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="section-label mb-8">Past requests</div>
                {pastRequests.map(r => (
                  <div key={r.id} className="sched-item">
                    <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 44 }}>
                      {format(new Date(r.requested_at), 'HH:mm')}
                    </div>
                    <div className={`sched-dot ${r.status === 'confirmed' ? 'dot-green' : 'dot-muted'}`} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {format(new Date(r.requested_at), 'EEE d MMM')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {r.duration_min} min{r.notes ? ` · ${r.notes}` : ''}
                      </div>
                    </div>
                    {requestStatusTag(r)}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}