import { useEffect, useState } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, addWeeks, subWeeks, addMonths, subMonths,
  isToday, parseISO, getHours } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)
const CLIENT_COLORS = [
  '#c9a96e', '#4eca87', '#6eafc9', '#c96e9a', '#9a6ec9', '#c9b96e', '#6ec9b9'
]

export default function CoachCalendar({ clients }) {
  const { profile } = useAuth()
  const [view, setView]           = useState('week')
  const [current, setCurrent]     = useState(new Date())
  const [sessions, setSessions]   = useState([])
  const [showForm, setShowForm]   = useState(false)
  const [formDate, setFormDate]   = useState('')
  const [formTime, setFormTime]   = useState('10:00')
  const [formClient, setFormClient] = useState('')
  const [formTitle, setFormTitle] = useState('Session with Hasan')
  const [formLocation, setFormLocation] = useState('')
  const [formDuration, setFormDuration] = useState(60)
  const [saving, setSaving]       = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)

  useEffect(() => { loadSessions() }, [current, view])

  async function loadSessions() {
    let start, end
    if (view === 'week') {
      start = startOfWeek(current, { weekStartsOn: 1 })
      end = endOfWeek(current, { weekStartsOn: 1 })
    } else {
      start = startOfMonth(current)
      end = endOfMonth(current)
    }
    const { data } = await supabase
      .from('scheduled_sessions')
      .select('*, profiles:client_id(full_name)')
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .order('starts_at')
    setSessions(data || [])
  }

  function clientColor(clientId) {
    const idx = clients.findIndex(c => c.id === clientId) % CLIENT_COLORS.length
    return CLIENT_COLORS[idx >= 0 ? idx : 0]
  }

  function clientName(clientId) {
    const c = clients.find(c => c.id === clientId)
    return c?.full_name || 'Unknown'
  }

  function handleSlotClick(date, hour) {
    setFormDate(format(date, 'yyyy-MM-dd'))
    setFormTime(`${String(hour).padStart(2, '0')}:00`)
    setFormClient(clients[0]?.id || '')
    setShowForm(true)
    setSelectedSession(null)
  }

  function handleDayClick(date) {
    setFormDate(format(date, 'yyyy-MM-dd'))
    setFormTime('10:00')
    setFormClient(clients[0]?.id || '')
    setShowForm(true)
    setSelectedSession(null)
  }

  async function saveSession() {
    if (!formClient || !formDate) return toast.error('Select a client and date')
    setSaving(true)
    try {
      const starts_at = new Date(`${formDate}T${formTime}`).toISOString()
      await supabase.from('scheduled_sessions').insert({
        client_id: formClient,
        title: formTitle,
        location: formLocation,
        starts_at,
        duration_min: formDuration,
        type: 'coached',
        status: 'scheduled',
        created_by: profile.id
      })
      toast.success('Session scheduled')
      setShowForm(false)
      loadSessions()
    } catch (e) {
      toast.error('Failed to schedule')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSession(id) {
    if (!window.confirm('Cancel this session?')) return
    await supabase.from('scheduled_sessions').update({ status: 'cancelled' }).eq('id', id)
    toast.success('Session cancelled')
    setSelectedSession(null)
    loadSessions()
  }

  function WeekView() {
    const weekStart = startOfWeek(current, { weekStartsOn: 1 })
    const allDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(current, { weekStartsOn: 1 }) })
    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '0.5px solid var(--border2)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>
          <div />
          {allDays.map(d => (
            <div key={d.toISOString()} style={{ padding: '8px 4px', textAlign: 'center', borderLeft: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em' }}>{format(d, 'EEE').toUpperCase()}</div>
              <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2, color: isToday(d) ? 'var(--gold)' : 'var(--text)', width: 28, height: 28, borderRadius: '50%', background: isToday(d) ? 'var(--gold-bg)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0' }}>{format(d, 'd')}</div>
            </div>
          ))}
        </div>
        {HOURS.map(hour => (
          <div key={hour} style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', minHeight: 56, borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', padding: '4px 6px 0', textAlign: 'right' }}>{hour}:00</div>
            {allDays.map(d => {
              const slotSessions = sessions.filter(s => {
                const sd = parseISO(s.starts_at)
                return isSameDay(sd, d) && getHours(sd) === hour && s.status !== 'cancelled'
              })
              return (
                <div key={d.toISOString()} onClick={() => handleSlotClick(d, hour)}
                  style={{ borderLeft: '0.5px solid var(--border)', padding: '2px 3px', cursor: 'pointer', minHeight: 56 }}>
                  {slotSessions.map(s => (
                    <div key={s.id} onClick={e => { e.stopPropagation(); setSelectedSession(s); setShowForm(false) }}
                      style={{ background: clientColor(s.client_id), borderRadius: 4, padding: '2px 5px', marginBottom: 2, fontSize: 10, fontWeight: 600, color: '#1a1a1a', cursor: 'pointer', lineHeight: 1.4 }}>
                      <div>{clientName(s.client_id)}</div>
                      <div style={{ fontWeight: 400, opacity: 0.8 }}>{format(parseISO(s.starts_at), 'HH:mm')}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
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
            const isCurrentMonth = d.getMonth() === current.getMonth()
            return (
              <div key={d.toISOString()} onClick={() => handleDayClick(d)}
                style={{ minHeight: 80, border: '0.5px solid var(--border)', padding: '6px', cursor: 'pointer', background: isToday(d) ? 'var(--gold-bg)' : 'transparent', opacity: isCurrentMonth ? 1 : 0.3 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: isToday(d) ? 'var(--gold)' : 'var(--text)' }}>{format(d, 'd')}</div>
                {daySessions.slice(0, 3).map(s => (
                  <div key={s.id} onClick={e => { e.stopPropagation(); setSelectedSession(s); setShowForm(false) }}
                    style={{ background: clientColor(s.client_id), borderRadius: 3, padding: '1px 4px', marginBottom: 2, fontSize: 9, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {format(parseISO(s.starts_at), 'HH:mm')} {clientName(s.client_id)}
                  </div>
                ))}
                {daySessions.length > 3 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{daySessions.length - 3} more</div>}
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
          <button onClick={() => { setShowForm(true); setFormDate(format(new Date(), 'yyyy-MM-dd')); setFormClient(clients[0]?.id || ''); setSelectedSession(null) }}
            style={{ background: 'var(--gold)', border: 'none', color: '#1a1a1a', cursor: 'pointer', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 600, fontFamily: 'Montserrat, sans-serif' }}>+ SESSION</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        {clients.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: CLIENT_COLORS[i % CLIENT_COLORS.length] }} />
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{c.full_name}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 20 }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 12, border: '0.5px solid var(--border2)' }}>
          {view === 'week' ? <WeekView /> : <MonthView />}
        </div>

        {(showForm || selectedSession) && (
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
                    <input className="input" type="time" value={formTime} onChange={e => setFormTime(e.target.value)} style={{ fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="input-label">Duration (min)</label>
                  <input className="input" type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)} style={{ fontSize: 12 }} />
                </div>
                <button className="btn btn-gold btn-sm" onClick={saveSession} disabled={saving}>
                  {saving ? 'Saving…' : 'Schedule'}
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
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{clientName(selectedSession.client_id)}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div className="section-label mb-8">Title</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{selectedSession.title}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div className="section-label mb-8">Date & time</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{format(parseISO(selectedSession.starts_at), 'EEE d MMM yyyy, HH:mm')}</div>
                </div>
                {selectedSession.location && (
                  <div style={{ marginBottom: 10 }}>
                    <div className="section-label mb-8">Location</div>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{selectedSession.location}</div>
                  </div>
                )}
                <div style={{ marginBottom: 16 }}>
                  <div className="section-label mb-8">Status</div>
                  <span className={`tag ${selectedSession.status === 'completed' ? 'tag-green' : selectedSession.status === 'cancelled' ? 'tag-muted' : 'tag-gold'}`}>
                    {selectedSession.status.toUpperCase()}
                  </span>
                </div>
                {selectedSession.status === 'scheduled' && (
                  <button className="btn btn-danger btn-sm" onClick={() => deleteSession(selectedSession.id)}>Cancel session</button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}