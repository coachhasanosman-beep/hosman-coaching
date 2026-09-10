import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function TrainingInReview({ clientId: propClientId }) {
  const { profile } = useAuth()
  const clientId = propClientId || profile?.id

  const [recaps, setRecaps]         = useState([])
  const [selected, setSelected]     = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => { if (clientId) load() }, [clientId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('recaps')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setRecaps(data || [])
    if (data && data.length > 0) setSelected(data[0])
    setLoading(false)
  }

  if (loading) return <div className="spinner">Loading…</div>

  if (recaps.length === 0) return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="brand-label">HOSMAN</div>
        <h1>Training in Review</h1>
      </div>
      <div className="page-scroll">
        <div style={{ color: 'var(--text3)', fontSize: 13, paddingTop: 40, textAlign: 'center' }}>
          No recaps yet — your coach will send your first Training in Review soon.
        </div>
      </div>
    </div>
  )

  const s = selected?.sections || {}

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="brand-label">HOSMAN</div>
        <h1>Training in Review</h1>
      </div>

      <div className="page-scroll">
        {/* Recap selector */}
        <div style={{ marginBottom: 20 }}>
          <label className="input-label">View recap</label>
          <select className="input" value={selected?.id || ''}
            onChange={e => setSelected(recaps.find(r => r.id === e.target.value))}>
            {recaps.map(r => (
              <option key={r.id} value={r.id}>
                {format(new Date(r.created_at), 'MMMM yyyy')} — {format(new Date(r.created_at), 'd MMM yyyy')}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <>
            {/* Coached sessions */}
            {s.coachedSessions && (
              <div style={{ marginBottom: 28 }}>
                <div className="section-label mb-12">Coached Sessions</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {[['This week', s.coachedSessions.week], ['This month', s.coachedSessions.month], ['This year', s.coachedSessions.year]].map(([label, val]) => (
                    <div key={label} className="metric-box" style={{ textAlign: 'center' }}>
                      <div className="label">{label}</div>
                      <div className="val">{val}</div>
                    </div>
                  ))}
                </div>
                {s.coachedSessions.weekly && (
                  <div style={{ height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={s.coachedSessions.weekly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'var(--text3)' }} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} allowDecimals={false} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '0.5px solid var(--border2)', borderRadius: 8, fontSize: 11 }} />
                        <Line type="monotone" dataKey="sessions" stroke="#c9a96e" strokeWidth={2} dot={{ fill: '#c9a96e', r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Solo sessions */}
            {s.soloSessions && (
              <div style={{ marginBottom: 28 }}>
                <div className="section-label mb-12">Solo Sessions</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {[['This week', s.soloSessions.week], ['This month', s.soloSessions.month], ['This year', s.soloSessions.year]].map(([label, val]) => (
                    <div key={label} className="metric-box" style={{ textAlign: 'center' }}>
                      <div className="label">{label}</div>
                      <div className="val">{val}</div>
                    </div>
                  ))}
                </div>
                {s.soloSessions.weekly && (
                  <div style={{ height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={s.soloSessions.weekly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'var(--text3)' }} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} allowDecimals={false} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '0.5px solid var(--border2)', borderRadius: 8, fontSize: 11 }} />
                        <Line type="monotone" dataKey="sessions" stroke="#4eca87" strokeWidth={2} dot={{ fill: '#4eca87', r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Upcoming sessions */}
            {s.upcomingSessions && s.upcomingSessions.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div className="section-label mb-12">Upcoming Sessions</div>
                {s.upcomingSessions.map((sess, i) => (
                  <div key={i} className="sched-item" style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 52 }}>{format(new Date(sess.starts_at), 'd MMM')}</div>
                    <div className="sched-dot dot-gold" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{sess.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{format(new Date(sess.starts_at), 'HH:mm')}{sess.location ? ` · ${sess.location}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load progression */}
            {s.loadProgression && s.loadProgression.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div className="section-label mb-12">Load Progression</div>
                {s.loadProgression.map((sess, si) => (
                  <div key={si} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 10 }}>{sess.name}</div>
                    {sess.exercises.map((ex, ei) => {
                      const data = ex.week_loads.map((val, i) => ({ week: `Wk ${i + 1}`, load: val !== '' && val !== null ? parseFloat(val) || null : null })).filter(d => d.load !== null)
                      if (data.length < 2) return null
                      const minLoad = Math.min(...data.map(d => d.load))
                      const maxLoad = Math.max(...data.map(d => d.load))
                      const padding = (maxLoad - minLoad) * 0.2 || 5
                      return (
                        <div key={ei} style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{ex.name}</div>
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
                ))}
              </div>
            )}

            {/* Body metrics */}
            {s.bodyMetrics && (
              <div style={{ marginBottom: 28 }}>
                <div className="section-label mb-12">Metrics</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {s.bodyMetrics.weight && (
                    <div className="metric-box">
                      <div className="label">Weight</div>
                      <div className="val">{s.bodyMetrics.weight}<span className="unit">kg</span></div>
                    </div>
                  )}
                  {s.bodyMetrics.body_fat && (
                    <div className="metric-box">
                      <div className="label">Body fat</div>
                      <div className="val">{s.bodyMetrics.body_fat}<span className="unit">%</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary */}
            {selected.summary && (
              <div style={{ marginBottom: 28 }}>
                <div className="section-label mb-12">Summary</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>{selected.summary}</div>
              </div>
            )}

            {/* Personal note */}
            {selected.personal_note && (
              <div style={{ marginBottom: 28, padding: 16, background: 'var(--gold-bg)', border: '0.5px solid var(--gold-bdr)', borderRadius: 12 }}>
                <div className="section-label mb-8">A note from Hasan</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{selected.personal_note}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}