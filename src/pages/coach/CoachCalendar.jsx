import { useEffect, useState, useRef } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, addWeeks, subWeeks, addMonths, subMonths,
  isToday, parseISO, getHours, getMinutes } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6)
const ROW_HEIGHT = 64 // px per hour
const CLIENT_COLORS = [
  '#c9a96e', '#4eca87', '#6eafc9', '#c96e9a', '#9a6ec9', '#c9b96e', '#6ec9b9'
]
const BLOCK_COLOR = '#555555'

export default function CoachCalendar({ clients }) {
  const { profile } = useAuth()
  const [view, setView]             = useState('week')
  const [current, setCurrent]       = useState(new Date())
  const [sessions, setSessions]     = useState([])
  const [coachEvents, setCoachEvents] = useState([])
  const [showForm, setShowForm]     = useState(false)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [formDate, setFormDate]     = useState('')
  const [formTime, setFormTime]     = useState('10:00')
  const [formClient, setFormClient] = useState('')
  const [formTitle, setFormTitle]   = useState('Session with Hasan')
  const [formLocation, setFormLocation] = useState('')
  const [formDuration, setFormDuration] = useState(60)
  const [blockForm, setBlockForm]   = useState({ title: '', notes: '', date: '', time: '09:00', duration: 60 })
  const [saving, setSaving]         = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const dragSession = useRef(null)
  const dragEvent = useRef(null)

  useEffect(() => { loadAll() }, [current, view])

  async function loadAll() {
    let start, end
    if (view === 'week') {
      start = startOfWeek(current, { weekStartsOn: 1 })
      end = endOfWeek(current, { weekStartsOn: 1 })
    } else {
      start = startOfMonth(current)
      end = endOfMonth(current)
    }
    const [sessRes, evtRes] = await Promise.all([
      supabase.from('scheduled_sessions')
        .select('*, profiles:client_id(full_name)')
        .gte('starts_at', start.toISOString())
        .lte('starts_at', end.toISOString())
        .order('starts_at'),
      supabase.from('coach_events')
        .select('*')
        .gte('starts_at', start.toISOString())
        .lte('starts_at', end.toISOString())
        .order('starts_at')
    ])
    setSessions(sessRes.data || [])
    setCoachEvents(evtRes.data || [])
  }

  function clientColor(clientId) {
    const idx = clients.findIndex(c => c.id === clientId) % CLIENT_COLORS.length
    return CLIENT_COLORS[idx >= 0 ? idx : 0]
  }

  function clientName(clientId) {
    const c = clients.find(c => c.id === clientId)
    return c?.full_name || 'Unknown'
  }

  // Convert time to pixels from top of grid
  function timeToPx(date) {
    const h = getHours(date) - 6
    const m = getMinutes(date)
    return h * ROW_HEIGHT + (m / 60) * ROW_HEIGHT
  }

  function durationToPx(minutes) {
    return (minutes / 60) * ROW_HEIGHT
  }

  function handleGridClick(date, e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const totalMinutes = Math.round((y / ROW_HEIGHT) * 60 / 15) * 15
    const hour = Math.floor(totalMinutes / 60) + 6
    const minutes = totalMinutes % 60
    setFormDate(format(date, 'yyyy-MM-dd'))
    setFormTime(`${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
    setFormClient(clients[0]?.id || '')
    setShowForm(true)
    setShowBlockForm(false)
    setSelectedSession(null)
    setSelectedEvent(null)
  }

  function handleDayClick(date) {
    setFormDate(format(date, 'yyyy-MM-dd'))
    setFormTime('10:00')
    setFormClient(clients[0]?.id || '')
    setShowForm(true)
    setShowBlockForm(false)
    setSelectedSession(null)
    setSelectedEvent(null)
  }

  async function sendCalendarInvite(session, clientEmail, clientName, cancelled = false) {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-calendar-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ session, clientEmail, clientName, cancelled })
      })
    } catch (e) {
      console.error('Calendar invite failed:', e)
    }
  }

  async function saveSession() {
    if (!formClient || !formDate) return toast.error('Select a client and date')
    setSaving(true)
    try {
      const starts_at = new Date(`${formDate}T${formTime}`).toISOString()
      const { data } = await supabase.from('scheduled_sessions').insert({
        client_id: formClient, title: formTitle, location: formLocation,
        starts_at, duration_min: formDuration, type: 'coached', status: 'scheduled', created_by: profile.id
      }).select().single()
      const client = clients.find(c => c.id === formClient)
      if (client) await sendCalendarInvite(data, client.email, client.full_name, false)
      toast.success('Session scheduled — calendar invite sent')
      setShowForm(false)
      loadAll()
    } catch (e) {
      toast.error('Failed to schedule')
    } finally {
      setSaving(false)
    }
  }

  async function saveBlockEvent() {
    if (!blockForm.title || !blockForm.date) return toast.error('Title and date required')
    setSaving(true)
    try {
      const starts_at = new Date(`${blockForm.date}T${blockForm.time}`).toISOString()
      await supabase.from('coach_events').insert({
        coach_id: profile.id, title: blockForm.title, notes: blockForm.notes,
        starts_at, duration_min: parseInt(blockForm.duration)
      })
      toast.success('Event added')
      setShowBlockForm(false)
      setBlockForm({ title: '', notes: '', date: '', time: '09:00', duration: 60 })
      loadAll()
    } catch (e) {
      toast.error('Failed to add event')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBlockEvent(id) {
    if (!window.confirm('Delete this event?')) return
    await supabase.from('coach_events').delete().eq('id', id)
    toast.success('Event deleted')
    setSelectedEvent(null)
    loadAll()
  }

  async function rescheduleSession(session, newDate, yPx) {
    const totalMinutes = Math.round((yPx / ROW_HEIGHT) * 60 / 15) * 15
    const hour = Math.floor(totalMinutes / 60) + 6
    const minutes = totalMinutes % 60
    const newStarts = new Date(newDate)
    newStarts.setHours(hour, minutes, 0, 0)
    const starts_at = newStarts.toISOString()
    await supabase.from('scheduled_sessions').update({ starts_at }).eq('id', session.id)
    const client = clients.find(c => c.id === session.client_id)
    if (client) await sendCalendarInvite({ ...session, starts_at }, client.email, client.full_name, false)
    toast.success('Session rescheduled — client notified')
    loadAll()
  }

  async function rescheduleEvent(event, newDate, yPx) {
    const totalMinutes = Math.round((yPx / ROW_HEIGHT) * 60 / 15) * 15
    const hour = Math.floor(totalMinutes / 60) + 6
    const minutes = totalMinutes % 60
    const newStarts = new Date(newDate)
    newStarts.setHours(hour, minutes, 0, 0)
    await supabase.from('coach_events').update({ starts_at: newStarts.toISOString() }).eq('id', event.id)
    toast.success('Event rescheduled')
    loadAll()
  }

  async function cancelSession(id) {
    if (!window.confirm('Cancel this session?')) return
    const sess = sessions.find(s => s.id === id)
    await supabase.from('scheduled_sessions').update({ status: 'cancelled' }).eq('id', id)
    if (sess) {
      const client = clients.find(c => c.id === sess.client_id)
      if (client) await sendCalendarInvite(sess, client.email, client.full_name, true)
    }
    toast.success('Session cancelled — client notified')
    setSelectedSession(null)
    loadAll()
  }

  function WeekView() {
    const weekStart = startOfWeek(current, { weekStartsOn: 1 })
    const allDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(current, { weekStartsOn: 1 }) })
    const totalHeight = HOURS.length * ROW_HEIGHT

    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '0.5px solid var(--border2)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 3 }}>
          <div />
          {allDays.map(d => (
            <div key={d.toISOString()} style={{ padding: '8px 4px', textAlign: 'center', borderLeft: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em' }}>{format(d, 'EEE').toUpperCase()}</div>
              <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2, color: isToday(d) ? 'var(--gold)' : 'var(--text)', width: 28, height: 28, borderRadius: '50%', background: isToday(d) ? 'var(--gold-bg)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0' }}>{format(d, 'd')}</div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', position: 'relative' }}>
          {/* Hour labels */}
          <div style={{ position: 'relative', height: totalHeight }}>
            {HOURS.map((hour, i) => (
              <div key={hour} style={{ position: 'absolute', top: i * ROW_HEIGHT, right: 6, fontSize: 10, color: 'var(--text3)', lineHeight: 1 }}>
                {hour}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {allDays.map(d => {
            const daySessions = sessions.filter(s => isSameDay(parseISO(s.starts_at), d) && s.status !== 'cancelled')
            const dayEvents = coachEvents.filter(e => isSameDay(parseISO(e.starts_at), d))

            return (
              <div key={d.toISOString()}
                style={{ position: 'relative', height: totalHeight, borderLeft: '0.5px solid var(--border)', cursor: 'pointer' }}
                onClick={e => handleGridClick(d, e)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top
                  if (dragSession.current) { rescheduleSession(dragSession.current, d, y); dragSession.current = null }
                  else if (dragEvent.current) { rescheduleEvent(dragEvent.current, d, y); dragEvent.current = null }
                }}>

                {/* Hour lines */}
                {HOURS.map((_, i) => (
                  <div key={i} style={{ position: 'absolute', top: i * ROW_HEIGHT, left: 0, right: 0, borderTop: '0.5px solid var(--border)', pointerEvents: 'none' }} />
                ))}

                {/* 15-min guide lines */}
                {HOURS.map((_, i) => (
                  [1,2,3].map(q => (
                    <div key={`${i}-${q}`} style={{ position: 'absolute', top: i * ROW_HEIGHT + q * (ROW_HEIGHT / 4), left: 0, right: 0, borderTop: '0.5px dashed rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
                  ))
                ))}

                {/* Sessions */}
                {daySessions.map(s => {
                  const top = timeToPx(parseISO(s.starts_at))
                  const height = Math.max(durationToPx(s.duration_min || 60), 20)
                  return (
                    <div key={s.id}
                      draggable
                      onDragStart={e => { e.stopPropagation(); dragSession.current = s }}
                      onClick={e => { e.stopPropagation(); setSelectedSession(s); setSelectedEvent(null); setShowForm(false); setShowBlockForm(false) }}
                      style={{
                        position: 'absolute', top, left: 2, right: 2, height,
                        background: clientColor(s.client_id), borderRadius: 4,
                        padding: '2px 5px', fontSize: 10, fontWeight: 600,
                        color: '#1a1a1a', cursor: 'grab', lineHeight: 1.4,
                        userSelect: 'none', zIndex: 2, overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                      }}>
                      <div>{clientName(s.client_id)}</div>
                      <div style={{ fontWeight: 400, opacity: 0.8 }}>{format(parseISO(s.starts_at), 'HH:mm')}</div>
                    </div>
                  )
                })}

                {/* Coach events */}
                {dayEvents.map(e => {
                  const top = timeToPx(parseISO(e.starts_at))
                  const height = Math.max(durationToPx(e.duration_min || 60), 20)
                  return (
                    <div key={e.id}
                      draggable
                      onDragStart={ev => { ev.stopPropagation(); dragEvent.current = e }}
                      onClick={ev => { ev.stopPropagation(); setSelectedEvent(e); setSelectedSession(null); setShowForm(false); setShowBlockForm(false) }}
                      style={{
                        position: 'absolute', top, left: 2, right: 2, height,
                        background: BLOCK_COLOR, borderRadius: 4,
                        padding: '2px 5px', fontSize: 10, fontWeight: 600,
                        color: '#f0f0f0', cursor: 'grab', lineHeight: 1.4,
                        userSelect: 'none', zIndex: 2, overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                      }}>
                      <div>{e.title}</div>
                      <div style={{ fontWeight: 400, opacity: 0.7 }}>{format(parseISO(e.starts_at), 'HH:mm')}</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function MonthView() {
    const monthStart = startOfMonth(current)
    const monthEnd = endOfMonth(current)
    const days = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) })
    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '0.5px solid var(--border2)' }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em' }}>{d.toUpperCase()}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map(d => {
            const daySessions = sessions.filter(s => isSameDay(parseISO(s.starts_at), d) && s.status !== 'cancelled')
            const dayEvents = coachEvents.filter(e => isSameDay(parseISO(e.starts_at), d))
            const isCurrentMonth = d.getMonth() === current.getMonth()
            const allItems = [
              ...daySessions.map(s => ({ ...s, _type: 'session' })),
              ...dayEvents.map(e => ({ ...e, _type: 'event' }))
            ].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
            return (
              <div key={d.toISOString()} onClick={() => handleDayClick(d)}
                style={{ minHeight: 80, border: '0.5px solid var(--border)', padding: '6px', cursor: 'pointer', background: isToday(d) ? 'var(--gold-bg)' : 'transparent', opacity: isCurrentMonth ? 1 : 0.3 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: isToday(d) ? 'var(--gold)' : 'var(--text)' }}>{format(d, 'd')}</div>
                {allItems.slice(0, 3).map(item => (
                  <div key={item.id}
                    onClick={e => { e.stopPropagation(); item._type === 'session' ? (setSelectedSession(item), setSelectedEvent(null)) : (setSelectedEvent(item), setSelectedSession(null)); setShowForm(false); setShowBlockForm(false) }}
                    style={{ background: item._type === 'session' ? clientColor(item.client_id) : BLOCK_COLOR, borderRadius: 3, padding: '1px 4px', marginBottom: 2, fontSize: 9, fontWeight: 600, color: item._type === 'session' ? '#1a1a1a' : '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {format(parseISO(item.starts_at), 'HH:mm')} {item._type === 'session' ? clientName(item.client_id) : item.title}
                  </div>
                ))}
                {allItems.length > 3 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{allItems.length - 3} more</div>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>Calendar</h1>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            {view === 'week'
              ? `${format(startOfWeek(current, { weekStartsOn: 1 }), 'd MMM')} – ${format(endOfWeek(current, { weekStartsOn: 1 }), 'd MMM yyyy')}`
              : format(current, 'MMMM yyyy')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 2 }}>
            {['week','month'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', cursor: 'pointer', border: 'none', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--text)' : 'var(--text3)', fontFamily: 'Montserrat, sans-serif' }}>{v.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => view === 'week' ? setCurrent(subWeeks(current, 1)) : setCurrent(subMonths(current, 1))}
            style={{ background: 'var(--surface2)', border: 'none', color: 'var(--text)', cursor: 'pointer', borderRadius: 6, padding: '6px 10px', fontSize: 14 }}>‹</button>
          <button onClick={() => setCurrent(new Date())}
            style={{ background: 'var(--surface2)', border: 'none', color: 'var(--text)', cursor: 'pointer', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, fontFamily: 'Montserrat, sans-serif' }}>TODAY</button>
          <button onClick={() => view === 'week' ? setCurrent(addWeeks(current, 1)) : setCurrent(addMonths(current, 1))}
            style={{ background: 'var(--surface2)', border: 'none', color: 'var(--text)', cursor: 'pointer', borderRadius: 6, padding: '6px 10px', fontSize: 14 }}>›</button>
          <button onClick={() => { setShowBlockForm(true); setShowForm(false); setSelectedSession(null); setSelectedEvent(null); setBlockForm(f => ({ ...f, date: format(new Date(), 'yyyy-MM-dd') })) }}
            style={{ background: 'var(--surface2)', border: '0.5px solid var(--border2)', color: 'var(--text)', cursor: 'pointer', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 600, fontFamily: 'Montserrat, sans-serif' }}>+ Block time</button>
          <button onClick={() => { setShowForm(true); setShowBlockForm(false); setFormDate(format(new Date(), 'yyyy-MM-dd')); setFormClient(clients[0]?.id || ''); setSelectedSession(null); setSelectedEvent(null) }}
            style={{ background: 'var(--gold)', border: 'none', color: '#1a1a1a', cursor: 'pointer', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 600, fontFamily: 'Montserrat, sans-serif' }}>+ Session</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
        {clients.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: CLIENT_COLORS[i % CLIENT_COLORS.length] }} />
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{c.full_name}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: BLOCK_COLOR }} />
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Blocked time</span>
        </div>
      </div>

      {view === 'week' && (
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em', marginBottom: 8, flexShrink: 0 }}>
          <i className="ti ti-arrows-move" style={{ fontSize: 11 }} /> Drag to reschedule · Click anywhere to schedule at exact time
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 20 }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 12, border: '0.5px solid var(--border2)' }}>
          {view === 'week' ? <WeekView /> : <MonthView />}
        </div>

        {(showForm || showBlockForm || selectedSession || selectedEvent) && (
          <div style={{ width: 260, background: 'var(--surface)', borderRadius: 12, border: '0.5px solid var(--border2)', padding: 18, flexShrink: 0, overflowY: 'auto' }}>
            {showForm && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>Schedule session</h3>
                  <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="input-label">Client</label>
                  <select className="input" value={formClient} onChange={e => setFormClient(e.target.value)} style={{ fontSize: 12 }}>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="input-label">Title</label>
                  <input className="input" value={formTitle} onChange={e => setFormTitle(e.target.value)} style={{ fontSize: 12 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="input-label">Location</label>
                  <input className="input" placeholder="e.g. Chelsea Physio" value={formLocation} onChange={e => setFormLocation(e.target.value)} style={{ fontSize: 12 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label className="input-label">Date</label>
                    <input className="input" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label className="input-label">Time</label>
                    <input className="input" type="time" step="900" value={formTime} onChange={e => setFormTime(e.target.value)} style={{ fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="input-label">Duration (min)</label>
                  <input className="input" type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)} style={{ fontSize: 12 }} />
                </div>
                <button className="btn btn-gold btn-sm" onClick={saveSession} disabled={saving}>
                  {saving ? 'Saving…' : 'Schedule & send invite'}
                </button>
              </>
            )}

            {showBlockForm && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>Block time</h3>
                  <button onClick={() => setShowBlockForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="input-label">Title</label>
                  <input className="input" placeholder="e.g. Admin, Own training" value={blockForm.title}
                    onChange={e => setBlockForm(f => ({ ...f, title: e.target.value }))} style={{ fontSize: 12 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="input-label">Notes (optional)</label>
                  <input className="input" placeholder="Any details..." value={blockForm.notes}
                    onChange={e => setBlockForm(f => ({ ...f, notes: e.target.value }))} style={{ fontSize: 12 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label className="input-label">Date</label>
                    <input className="input" type="date" value={blockForm.date}
                      onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))} style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label className="input-label">Time</label>
                    <input className="input" type="time" step="900" value={blockForm.time}
                      onChange={e => setBlockForm(f => ({ ...f, time: e.target.value }))} style={{ fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="input-label">Duration (min)</label>
                  <input className="input" type="number" value={blockForm.duration}
                    onChange={e => setBlockForm(f => ({ ...f, duration: e.target.value }))} style={{ fontSize: 12 }} />
                </div>
                <button className="btn btn-primary btn-sm" onClick={saveBlockEvent} disabled={saving}>
                  {saving ? 'Saving…' : 'Add to calendar'}
                </button>
              </>
            )}

            {selectedSession && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>Session</h3>
                  <button onClick={() => setSelectedSession(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div className="section-label mb-8">Client</div>
                  <div style={{ fontSize: 13 }}>{clientName(selectedSession.client_id)}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div className="section-label mb-8">Title</div>
                  <div style={{ fontSize: 13 }}>{selectedSession.title}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div className="section-label mb-8">Date & time</div>
                  <div style={{ fontSize: 13 }}>{format(parseISO(selectedSession.starts_at), 'EEE d MMM yyyy, HH:mm')}</div>
                </div>
                {selectedSession.location && (
                  <div style={{ marginBottom: 10 }}>
                    <div className="section-label mb-8">Location</div>
                    <div style={{ fontSize: 13 }}>{selectedSession.location}</div>
                  </div>
                )}
                <div style={{ marginBottom: 16 }}>
                  <div className="section-label mb-8">Status</div>
                  <span className={`tag ${selectedSession.status === 'completed' ? 'tag-green' : selectedSession.status === 'cancelled' ? 'tag-muted' : 'tag-gold'}`}>
                    {selectedSession.status.toUpperCase()}
                  </span>
                </div>
                {selectedSession.status === 'scheduled' && (
                  <button className="btn btn-danger btn-sm" onClick={() => cancelSession(selectedSession.id)}>Cancel session</button>
                )}
              </>
            )}

            {selectedEvent && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>Blocked time</h3>
                  <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div className="section-label mb-8">Title</div>
                  <div style={{ fontSize: 13 }}>{selectedEvent.title}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div className="section-label mb-8">Date & time</div>
                  <div style={{ fontSize: 13 }}>{format(parseISO(selectedEvent.starts_at), 'EEE d MMM yyyy, HH:mm')}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div className="section-label mb-8">Duration</div>
                  <div style={{ fontSize: 13 }}>{selectedEvent.duration_min} min</div>
                </div>
                {selectedEvent.notes && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="section-label mb-8">Notes</div>
                    <div style={{ fontSize: 13 }}>{selectedEvent.notes}</div>
                  </div>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => deleteBlockEvent(selectedEvent.id)}>Delete event</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}