import { useEffect, useState } from 'react'
import { format, isToday, isPast, isFuture, startOfWeek, endOfWeek,
  eachDayOfInterval, addWeeks, subWeeks, isSameDay } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const SLOT_DURATION = 60
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export default function SchedulePage({ clientId: propClientId }) {
  const { profile } = useAuth()
  const clientId = propClientId || profile?.id

  const [sessions, setSessions]         = useState([])
  const [requests, setRequests]         = useState([])
  const [availability, setAvailability] = useState([])
  const [busySlots, setBusySlots]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [currentWeek, setCurrentWeek]   = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [showLog, setShowLog]           = useState(false)
  const [showBooking, setShowBooking]   = useState(false)
  const [reqNotes, setReqNotes]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [form, setForm]                 = useState({ title: '', date: '', time: '', notes: '' })

  useEffect(() => { if (clientId) load() }, [clientId])

  useEffect(() => {
    if (showBooking) loadBusy()
  }, [currentWeek, showBooking])

  async function load() {
    setLoading(true)
    const [sessRes, reqRes, availRes] = await Promise.all([
      supabase.from('scheduled_sessions').select('*').eq('client_id', clientId).order('starts_at', { ascending: false }),
      supabase.from('booking_requests').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('coach_availability').select('*')
    ])
    setSessions(sessRes.data || [])
    setRequests(reqRes.data || [])
    setAvailability(availRes.data || [])
    setLoading(false)
  }

  async function loadBusy() {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 })
    const end = endOfWeek(currentWeek, { weekStartsOn: 1 })

    const [sessRes, evtRes] = await Promise.all([
      supabase.from('scheduled_sessions')
        .select('starts_at, duration_min')
        .gte('starts_at', start.toISOString())
        .lte('starts_at', end.toISOString())
        .neq('status', 'cancelled'),
      supabase.from('coach_events')
        .select('starts_at, duration_min')
        .gte('starts_at', start.toISOString())
        .lte('starts_at', end.toISOString())
    ])

    const busy = [...(sessRes.data || []), ...(evtRes.data || [])]
    console.log('Busy slots loaded:', busy)
    setBusySlots(busy)
  }

  function isSlotAvailable(date, hour) {
    const dayOfWeek = date.getDay()
    const avail = availability.find(a => a.day_of_week === dayOfWeek)
    if (!avail) return false

    const slotTime = `${String(hour).padStart(2, '0')}:00`
    if (slotTime < avail.start_time || slotTime >= avail.end_time) return false

    const slotDate = new Date(date)
    slotDate.setHours(hour, 0, 0, 0)
    if (slotDate < new Date()) return false

    const isBusy = busySlots.some(b => {
      const bStart = new Date(b.starts_at)
      const bEnd = new Date(bStart.getTime() + (b.duration_min || 60) * 60000)
      const sStart = new Date(slotDate)
      const sEnd = new Date(sStart.getTime() + SLOT_DURATION * 60000)
      return sStart < bEnd && sEnd > bStart
    })

    const isRequested = requests.some(r => {
      const rDate = new Date(r.requested_at)
      return isSameDay(rDate, date) && rDate.getHours() === hour && r.status === 'pending'
    })

    return !isBusy && !isRequested
  }

  async function submitRequest() {
    if (!selectedSlot) return
    setSaving(true)
    try {
      const requested_at = new Date(selectedSlot.date)
      requested_at.setHours(selectedSlot.hour, 0, 0, 0)

      await supabase.from('booking_requests').insert({
        client_id: clientId,
        requested_at: requested_at.toISOString(),
        duration_min: SLOT_DURATION,
        notes: reqNotes,
        status: 'pending'
      })

      const { data: { session: authSession } } = await supabase.auth.getSession()
      await fetch(`${SUPABASE_URL}/functions/v1/booking-request-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          clientName: profile.full_name,
          clientEmail: profile.email,
          requestedAt: requested_at.toISOString(),
          duration: SLOT_DURATION,
          notes: reqNotes
        })
      })

      toast.success('Request sent to your coach')
      setSelectedSlot(null)
      setReqNotes('')
      setShowBooking(false)
      load()
      loadBusy()
    } catch (e) {
      toast.error('Failed to send request')
    } finally {
      setSaving(false)
    }
  }

  async function logSession() {
    if (!form.title || !form.date) return
    setSaving(true)
    try {
      const starts_at = new Date(`${form.date}T${form.time || '00:00'}`).toISOString()
      await supabase.from('scheduled_sessions').insert({
        client_id: clientId, title: form.title, starts_at,
        type: 'solo', status: 'completed', notes: form.notes, created_by: profile.id
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
  const past = sessions.filter(s => s.status !== 'scheduled' || isPast(new Date(s.starts_at)))
  const pendingRequests = requests.filter(r => r.status === 'pending')

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentWeek, { weekStartsOn: 1 }) })

  const allHours = []
  weekDays.forEach(d => {
    const dayOfWeek = d.getDay()
    const avail = availability.find(a => a.day_of_week === dayOfWeek)
    if (avail) {
      const startH = parseInt(avail.start_time.split(':')[0])
      const endH = parseInt(avail.end_time.split(':')[0])
      for (let h = startH; h < endH; h++) {
        if (!allHours.includes(h)) allHours.push(h)
      }
    }
  })
  allHours.sort((a, b) => a - b)

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
            {!showBooking && !showLog && (
              <button className="btn btn-gold mb-20" onClick={() => setShowBooking(true)}>
                <i className="ti ti-calendar-plus" style={{ fontSize: 14 }} />
                Book a session
              </button>
            )}

            {showBooking && (
              <div className="card mb-20">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>Book a session</h3>
                  <button onClick={() => { setShowBooking(false); setSelectedSlot(null) }}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <button onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                    style={{ background: 'var(--surface2)', border: 'none', color: 'var(--text)', cursor: 'pointer', borderRadius: 6, padding: '4px 10px', fontSize: 14 }}>‹</button>
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                    {format(weekStart, 'd MMM')} – {format(weekDays[6], 'd MMM yyyy')}
                  </div>
                  <button onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                    style={{ background: 'var(--surface2)', border: 'none', color: 'var(--text)', cursor: 'pointer', borderRadius: 6, padding: '4px 10px', fontSize: 14 }}>›</button>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--gold)' }} />
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>Available</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--surface3)' }} />
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>Unavailable</span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40, padding: '4px' }}></th>
                        {weekDays.slice(0, 6).map(d => (
                          <th key={d.toISOString()} style={{ padding: '4px', textAlign: 'center', color: isToday(d) ? 'var(--gold)' : 'var(--text3)', fontWeight: 500 }}>
                            <div>{format(d, 'EEE')}</div>
                            <div style={{ fontSize: 13, color: isToday(d) ? 'var(--gold)' : 'var(--text)' }}>{format(d, 'd')}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allHours.map(hour => (
                        <tr key={hour}>
                          <td style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'right', paddingRight: 6, paddingTop: 2 }}>{hour}:00</td>
                          {weekDays.slice(0, 6).map(d => {
                            const available = isSlotAvailable(d, hour)
                            const isSelected = selectedSlot && isSameDay(selectedSlot.date, d) && selectedSlot.hour === hour
                            return (
                              <td key={d.toISOString()} style={{ padding: 2 }}>
                                <div
                                  onClick={() => available && setSelectedSlot({ date: d, hour })}
                                  style={{
                                    height: 28, borderRadius: 4,
                                    cursor: available ? 'pointer' : 'default',
                                    background: isSelected ? 'var(--gold)' : available ? 'rgba(201,169,110,0.15)' : 'var(--surface2)',
                                    border: isSelected ? '1.5px solid var(--gold)' : available ? '1px solid rgba(201,169,110,0.3)' : '1px solid transparent',
                                    transition: 'all 0.1s'
                                  }}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedSlot && (
                  <div style={{ marginTop: 16, padding: 12, background: 'var(--gold-bg)', border: '0.5px solid var(--gold-bdr)', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--gold)' }}>
                      {format(selectedSlot.date, 'EEE d MMM')} at {String(selectedSlot.hour).padStart(2, '0')}:00
                    </div>
                    <div className="mb-12">
                      <label className="input-label">Notes for your coach (optional)</label>
                      <input className="input" placeholder="Any preferences?" value={reqNotes}
                        onChange={e => setReqNotes(e.target.value)} style={{ fontSize: 12 }} />
                    </div>
                    <button className="btn btn-gold btn-sm" onClick={submitRequest} disabled={saving}>
                      {saving ? 'Sending…' : 'Request this slot'}
                    </button>
                  </div>
                )}
              </div>
            )}

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
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{format(new Date(r.requested_at), 'EEE d MMM')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.duration_min} min{r.notes ? ` · ${r.notes}` : ''}</div>
                    </div>
                    {requestStatusTag(r)}
                  </div>
                ))}
              </div>
            )}

            {Object.entries(upcomingGroups).sort().map(([date, items]) => {
              const d = new Date(date)
              const label = isToday(d) ? 'Today' : format(d, 'EEE d MMM').toUpperCase()
              return <DayGroup key={date} label={label} items={items} />
            })}
            {!upcoming.length && !pendingRequests.length && (
              <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>No upcoming sessions scheduled.</div>
            )}

            {!showLog && !showBooking && (
              <button className="btn btn-ghost mb-20" onClick={() => setShowLog(true)}>
                <i className="ti ti-plus" style={{ fontSize: 14 }} />
                Log a session
              </button>
            )}

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

            {past.length > 0 && <DayGroup label="Past sessions" items={past.slice(0, 20)} />}
          </>
        )}
      </div>
    </div>
  )
}