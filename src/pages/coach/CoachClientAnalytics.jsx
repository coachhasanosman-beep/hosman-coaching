import { useEffect, useState } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, subWeeks } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

export default function CoachClientAnalytics({ client }) {
  const [loading, setLoading]           = useState(true)
  const [sessionStats, setSessionStats] = useState({ week: 0, month: 0, year: 0, weekly: [] })
  const [soloStats, setSoloStats]       = useState({ week: 0, month: 0, year: 0, weekly: [] })
  const [upcoming, setUpcoming]         = useState([])
  const [programmes, setProgrammes]     = useState([])
  const [activeProg, setActiveProg]     = useState(null)
  const [sessions, setProgSessions]     = useState([])
  const [activeSession, setActiveSession] = useState(0)
  const [metrics, setMetrics]           = useState([])

  const [showRecap, setShowRecap]       = useState(false)
  const [recapSections, setRecapSections] = useState({
    coachedSessions: true,
    soloSessions: true,
    loadProgression: true,
    bodyMetrics: true,
    upcomingSessions: true
  })
  const [recapSummary, setRecapSummary] = useState('')
  const [personalNote, setPersonalNote] = useState('')
  const [sending, setSending]           = useState(false)
  const [previewMode, setPreviewMode]   = useState(false)

  useEffect(() => { if (client) loadAll() }, [client])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadSessionStats(), loadUpcoming(), loadProgrammes(), loadMetrics()])
    setLoading(false)
  }

  async function loadSessionStats() {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const yearStart = startOfYear(now)
    const yearEnd = endOfYear(now)

    const { data: all } = await supabase
      .from('scheduled_sessions')
      .select('starts_at, type, status')
      .eq('client_id', client.id)
      .eq('status', 'completed')

    const coached = (all || []).filter(s => s.type === 'coached')
    const solo = (all || []).filter(s => s.type === 'solo')

    const weeklyCoached = []
    const weeklySolo = []
    for (let i = 11; i >= 0; i--) {
      const wStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const wEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const label = format(wStart, 'd MMM')
      weeklyCoached.push({ week: label, sessions: coached.filter(s => new Date(s.starts_at) >= wStart && new Date(s.starts_at) <= wEnd).length })
      weeklySolo.push({ week: label, sessions: solo.filter(s => new Date(s.starts_at) >= wStart && new Date(s.starts_at) <= wEnd).length })
    }

    setSessionStats({
      week: coached.filter(s => new Date(s.starts_at) >= weekStart && new Date(s.starts_at) <= weekEnd).length,
      month: coached.filter(s => new Date(s.starts_at) >= monthStart && new Date(s.starts_at) <= monthEnd).length,
      year: coached.filter(s => new Date(s.starts_at) >= yearStart && new Date(s.starts_at) <= yearEnd).length,
      weekly: weeklyCoached
    })
    setSoloStats({
      week: solo.filter(s => new Date(s.starts_at) >= weekStart && new Date(s.starts_at) <= weekEnd).length,
      month: solo.filter(s => new Date(s.starts_at) >= monthStart && new Date(s.starts_at) <= monthEnd).length,
      year: solo.filter(s => new Date(s.starts_at) >= yearStart && new Date(s.starts_at) <= yearEnd).length,
      weekly: weeklySolo
    })
  }

  async function loadUpcoming() {
    const { data } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('client_id', client.id)
      .eq('status', 'scheduled')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(5)
    setUpcoming(data || [])
  }

  async function loadProgrammes() {
    const { data: progs } = await supabase
      .from('programmes')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })

    if (!progs || progs.length === 0) return
    setProgrammes(progs)
    setActiveProg(progs[0])
    await loadProgSessions(progs[0].id)
  }

  async function loadProgSessions(progId) {
    const { data: sess } = await supabase
      .from('programme_sessions')
      .select('*, exercises(*)')
      .eq('programme_id', progId)
      .order('position')

    const normalised = (sess || []).map(s => ({
      ...s,
      exercises: (s.exercises || [])
        .sort((a, b) => a.position - b.position)
        .map(e => ({
          ...e,
          week_loads: Array.isArray(e.week_loads) ? e.week_loads : JSON.parse(e.week_loads || '[]')
        }))
        .filter(e => e.name && e.week_loads.some(w => w !== '' && w !== null))
    }))
    setProgSessions(normalised)
    setActiveSession(0)
  }

  async function loadMetrics() {
    const { data } = await supabase
      .from('metrics')
      .select('*')
      .eq('client_id', client.id)
      .order('recorded_at', { ascending: false })
      .limit(10)
    setMetrics(data || [])
  }

  async function switchProg(prog) {
    setActiveProg(prog)
    await loadProgSessions(prog.id)
  }

  function generateSummary() {
    const lines = []
    if (recapSections.coachedSessions) lines.push(`${client.full_name} completed ${sessionStats.month} coached session${sessionStats.month !== 1 ? 's' : ''} this month and ${sessionStats.year} this year.`)
    if (recapSections.soloSessions && soloStats.month > 0) lines.push(`They also logged ${soloStats.month} solo session${soloStats.month !== 1 ? 's' : ''} independently this month.`)
    if (recapSections.loadProgression && sessions.length > 0) lines.push(`Load progression has been tracked across ${sessions.length} session type${sessions.length !== 1 ? 's' : ''} in the current block.`)
    if (recapSections.upcomingSessions && upcoming.length > 0) lines.push(`${upcoming.length} session${upcoming.length !== 1 ? 's are' : ' is'} scheduled upcoming.`)
    setRecapSummary(lines.join(' '))
  }

  async function sendRecap() {
    setSending(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()

      // Build sections data to store
      const sectionsData = {
        coachedSessions: recapSections.coachedSessions ? { week: sessionStats.week, month: sessionStats.month, year: sessionStats.year, weekly: sessionStats.weekly } : null,
        soloSessions: recapSections.soloSessions ? { week: soloStats.week, month: soloStats.month, year: soloStats.year, weekly: soloStats.weekly } : null,
        upcomingSessions: recapSections.upcomingSessions ? upcoming : null,
        loadProgression: recapSections.loadProgression ? sessions.map(s => ({ name: s.name, exercises: s.exercises.map(e => ({ name: e.name, week_loads: e.week_loads })) })) : null,
        bodyMetrics: recapSections.bodyMetrics && metrics.length > 0 ? metrics[0] : null
      }

      // Save recap to database
      await supabase.from('recaps').insert({
        client_id: client.id,
        title: 'Training in Review',
        sections: sectionsData,
        summary: recapSummary,
        personal_note: personalNote
      })

      // Send notification email
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({
          from: 'HOSMAN Coaching <noreply@hosmancoaching.com>',
          to: [client.email],
          subject: 'Your Training in Review is ready',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
              <div style="background:#1a1a1a;padding:24px;text-align:center">
                <h1 style="color:#c9a96e;font-size:20px;letter-spacing:0.15em;margin:0">HOSMAN</h1>
                <p style="color:#888;font-size:11px;letter-spacing:0.1em;margin:4px 0 0">PREMIUM COACHING</p>
              </div>
              <div style="padding:32px 24px">
                <h2 style="margin:0 0 16px">Your Training in Review is ready</h2>
                <p>Hi ${client.full_name},</p>
                <p>Your coach has put together a review of your training progress. Open the app to see your full breakdown including session stats, load progression charts and more.</p>
                ${personalNote ? `<div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0 0 6px;font-weight:600">A note from Hasan:</p><p style="margin:0">${personalNote}</p></div>` : ''}
                <div style="text-align:center;margin:28px 0">
                  <a href="https://hosman-coaching.vercel.app"
                    style="background:#c9a96e;color:#1a1a1a;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.06em">
                    VIEW IN APP
                  </a>
                </div>
                <p style="color:#888;font-size:12px;margin-top:24px">HOSMAN Premium Coaching</p>
              </div>
            </div>
          `
        })
      })

      toast.success('Training in Review sent!')
      setShowRecap(false)
      setPreviewMode(false)
      setPersonalNote('')
      setRecapSummary('')
    } catch (e) {
      toast.error('Failed to send')
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading analytics…</div>

  const currSession = sessions[activeSession]

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>

      {/* Coached sessions */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-label mb-12">Coached Sessions</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[['This week', sessionStats.week], ['This month', sessionStats.month], ['This year', sessionStats.year]].map(([label, val]) => (
            <div key={label} className="metric-box" style={{ textAlign: 'center' }}>
              <div className="label">{label}</div>
              <div className="val">{val}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sessionStats.weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'var(--text3)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} allowDecimals={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '0.5px solid var(--border2)', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="sessions" stroke="#c9a96e" strokeWidth={2} dot={{ fill: '#c9a96e', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Solo sessions */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-label mb-12">Solo Sessions</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[['This week', soloStats.week], ['This month', soloStats.month], ['This year', soloStats.year]].map(([label, val]) => (
            <div key={label} className="metric-box" style={{ textAlign: 'center' }}>
              <div className="label">{label}</div>
              <div className="val">{val}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={soloStats.weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'var(--text3)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} allowDecimals={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '0.5px solid var(--border2)', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="sessions" stroke="#4eca87" strokeWidth={2} dot={{ fill: '#4eca87', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-label mb-12">Upcoming Sessions</div>
          {upcoming.map(s => (
            <div key={s.id} className="sched-item" style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 52 }}>{format(new Date(s.starts_at), 'd MMM')}</div>
              <div className="sched-dot dot-gold" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{format(new Date(s.starts_at), 'HH:mm')}{s.location ? ` · ${s.location}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load progression */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-label mb-12">Load Progression</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {programmes.map(p => (
              <button key={p.id} onClick={() => switchProg(p)}
                style={{ padding: '4px 10px', borderRadius: 16, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'Montserrat, sans-serif', background: activeProg?.id === p.id ? 'var(--gold)' : 'var(--surface2)', color: activeProg?.id === p.id ? '#1a1a1a' : 'var(--text3)' }}>
                {p.title.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {sessions.map((s, i) => (
              <button key={s.id} onClick={() => setActiveSession(i)}
                style={{ padding: '4px 10px', borderRadius: 16, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'Montserrat, sans-serif', background: activeSession === i ? 'var(--surface3)' : 'var(--surface2)', color: activeSession === i ? 'var(--text)' : 'var(--text3)' }}>
                {s.name}
              </button>
            ))}
          </div>

          {currSession?.exercises.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>No load data recorded for this session yet.</div>
          )}

          {currSession?.exercises.map(ex => {
            const rawData = ex.week_loads.map((val, i) => ({ week: `Wk ${i + 1}`, load: val !== '' && val !== null ? parseFloat(val) || null : null }))
            const data = rawData.filter(d => d.load !== null)
            if (data.length < 2) return null
            const minLoad = Math.min(...data.map(d => d.load))
            const maxLoad = Math.max(...data.map(d => d.load))
            const padding = (maxLoad - minLoad) * 0.2 || 5
            return (
              <div key={ex.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>{ex.name}</div>
                <div style={{ height: 100 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'var(--text3)' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} domain={[minLoad - padding, maxLoad + padding]} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '0.5px solid var(--border2)', borderRadius: 8, fontSize: 11 }} />
                      <Line type="monotone" dataKey="load" stroke="#c9a96e" strokeWidth={2} dot={{ fill: '#c9a96e', r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Body metrics */}
      {metrics.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-label mb-12">Latest Metrics</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {metrics[0].weight && (
              <div className="metric-box">
                <div className="label">Weight</div>
                <div className="val">{metrics[0].weight}<span className="unit">kg</span></div>
              </div>
            )}
            {metrics[0].body_fat && (
              <div className="metric-box">
                <div className="label">Body fat</div>
                <div className="val">{metrics[0].body_fat}<span className="unit">%</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recap builder */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="section-label">Training in Review</div>
          <button className="btn btn-gold btn-sm" style={{ width: 'auto' }}
            onClick={() => { setShowRecap(!showRecap); if (!showRecap) generateSummary() }}>
            {showRecap ? 'Close' : 'Build recap'}
          </button>
        </div>

        {showRecap && (
          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Include sections:</div>
              {[
                ['coachedSessions', 'Coached sessions'],
                ['soloSessions', 'Solo sessions'],
                ['loadProgression', 'Load progression'],
                ['bodyMetrics', 'Body metrics'],
                ['upcomingSessions', 'Upcoming sessions']
              ].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={recapSections[key]}
                    onChange={e => setRecapSections(prev => ({ ...prev, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="input-label">Auto-generated summary (editable)</label>
              <textarea className="input" rows={4} value={recapSummary}
                onChange={e => setRecapSummary(e.target.value)}
                style={{ resize: 'vertical', fontSize: 12 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Personal note (optional)</label>
              <textarea className="input" rows={3} placeholder="Add a personal message to your client…"
                value={personalNote} onChange={e => setPersonalNote(e.target.value)}
                style={{ resize: 'vertical', fontSize: 12 }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setPreviewMode(!previewMode)}>
                {previewMode ? 'Hide preview' : 'Preview email'}
              </button>
              <button className="btn btn-gold btn-sm" style={{ flex: 1 }} onClick={sendRecap} disabled={sending}>
                {sending ? 'Sending…' : 'Send recap'}
              </button>
            </div>

            {previewMode && (
              <div style={{ marginTop: 16, padding: 16, background: '#fff', borderRadius: 8, color: '#1a1a1a', fontSize: 13 }}>
                <div style={{ background: '#1a1a1a', padding: 16, textAlign: 'center', marginBottom: 16, borderRadius: 6 }}>
                  <div style={{ color: '#c9a96e', fontSize: 16, letterSpacing: '0.15em', fontWeight: 700 }}>HOSMAN</div>
                  <div style={{ color: '#888', fontSize: 10 }}>PREMIUM COACHING</div>
                </div>
                <h2 style={{ marginBottom: 12 }}>Your Training in Review is ready</h2>
                <p>Hi {client.full_name},</p>
                <p>Your coach has put together a review of your training progress. Open the app to see your full breakdown.</p>
                {personalNote && <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, marginTop: 12 }}><strong>A note from Hasan:</strong><br />{personalNote}</div>}
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <div style={{ background: '#c9a96e', color: '#1a1a1a', padding: '12px 24px', borderRadius: 8, display: 'inline-block', fontWeight: 700 }}>VIEW IN APP</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}