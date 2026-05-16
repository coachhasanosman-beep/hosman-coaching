import { useState } from 'react'
import ProgrammePage from '../client/ProgrammePage'
import SchedulePage  from '../client/SchedulePage'
import MetricsPage   from '../client/MetricsPage'
import CoachSessionManager from './CoachSessionManager'

const TABS = ['Programme', 'Schedule', 'Sessions', 'Metrics']

export default function CoachClientView({ client, onBack }) {
  const [tab, setTab] = useState(0)

  function initials(name) {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Client header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>
          <i className="ti ti-arrow-left" style={{ fontSize: 20 }} aria-hidden="true" />
        </button>
        <div className="avatar avatar-lg">{initials(client.full_name)}</div>
        <div>
          <h2 style={{ marginBottom: 2 }}>{client.full_name}</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{client.email}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border2)', marginBottom: 24, marginLeft: -32, marginRight: -32, paddingLeft: 32 }}>
        {TABS.map((t, i) => (
          <button key={t}
            onClick={() => setTab(i)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              borderBottom: `1.5px solid ${tab === i ? 'var(--text)' : 'transparent'}`,
              color: tab === i ? 'var(--text)' : 'var(--text3)',
              fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer'
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Content — reuse client pages passing clientId */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 0 && <ProgrammePage clientId={client.id} />}
        {tab === 1 && <SchedulePage  clientId={client.id} />}
        {tab === 2 && <CoachSessionManager clientId={client.id} client={client} />}
        {tab === 3 && <MetricsPage   clientId={client.id} />}
      </div>
    </div>
  )
}
