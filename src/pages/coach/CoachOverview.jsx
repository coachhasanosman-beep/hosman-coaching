import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function CoachOverview({ clients, onSelectClient }) {
  const [summaries, setSummaries] = useState({})

  useEffect(() => {
    clients.forEach(loadSummary)
  }, [clients])

  async function loadSummary(client) {
    const [pkgRes, schedRes] = await Promise.all([
      supabase.from('packages').select('sessions_total,sessions_used').eq('client_id', client.id).order('purchased_at', { ascending: false }).limit(1),
      supabase.from('scheduled_sessions').select('starts_at,title').eq('client_id', client.id).eq('status', 'scheduled').gte('starts_at', new Date().toISOString()).order('starts_at').limit(1)
    ])
    setSummaries(prev => ({
      ...prev,
      [client.id]: {
        pkg: pkgRes.data?.[0],
        next: schedRes.data?.[0]
      }
    }))
  }

  function initials(name) {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  }

  return (
    <div>
      <h1 style={{ marginBottom: 6 }}>All clients</h1>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 28 }}>
        {clients.length} client{clients.length !== 1 ? 's' : ''} · Select a client to manage their programme, schedule and metrics
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {clients.map(c => {
          const s = summaries[c.id]
          const remaining = s?.pkg ? s.pkg.sessions_total - s.pkg.sessions_used : null
          return (
            <div key={c.id} className="card" style={{ cursor: 'pointer' }} onClick={() => onSelectClient(c)}>
              <div className="row mb-12">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar avatar-lg">{initials(c.full_name)}</div>
                  <div>
                    <h3 style={{ marginBottom: 2 }}>{c.full_name}</h3>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.email}</div>
                  </div>
                </div>
                <i className="ti ti-chevron-right" style={{ color: 'var(--text3)' }} aria-hidden="true" />
              </div>
              <div className="divider" />
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: 2 }}>SESSIONS LEFT</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: remaining !== null && remaining <= 3 ? 'var(--red)' : 'var(--text)' }}>
                    {remaining !== null ? remaining : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: 2 }}>NEXT SESSION</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                    {s?.next ? new Date(s.next.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {clients.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text3)', fontSize: 13 }}>
          No clients yet. Use "Invite client" in the sidebar to get started.
        </div>
      )}
    </div>
  )
}
