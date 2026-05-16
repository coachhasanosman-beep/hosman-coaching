import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const METRICS = [
  { key: 'weight_kg',    label: 'Weight',   unit: 'kg',  color: '#c9a96e' },
  { key: 'smm_kg',       label: 'Muscle',   unit: 'kg',  color: '#4eca87' },
  { key: 'body_fat_pct', label: 'Body fat', unit: '%',   color: '#e07070' },
]

export default function MetricsPage({ clientId: propClientId }) {
  const { profile } = useAuth()
  const clientId = propClientId || profile?.id

  const [history, setHistory] = useState([])
  const [activeMetric, setActive] = useState('weight_kg')
  const [form, setForm] = useState({ weight_kg: '', smm_kg: '', body_fat_pct: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (clientId) load() }, [clientId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('metrics')
      .select('*')
      .eq('client_id', clientId)
      .order('recorded_at', { ascending: false })
      .limit(50)
    setHistory(data || [])
    setLoading(false)
  }

  async function saveReading() {
    const { weight_kg, smm_kg, body_fat_pct } = form
    if (!weight_kg && !smm_kg && !body_fat_pct) {
      toast.error('Enter at least one value')
      return
    }
    setSaving(true)
    try {
      await supabase.from('metrics').insert({
        client_id: clientId,
        weight_kg: weight_kg ? parseFloat(weight_kg) : null,
        smm_kg: smm_kg ? parseFloat(smm_kg) : null,
        body_fat_pct: body_fat_pct ? parseFloat(body_fat_pct) : null,
        entered_by: profile.id
      })
      toast.success('Reading saved')
      setForm({ weight_kg: '', smm_kg: '', body_fat_pct: '' })
      load()
    } catch (e) {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const chartData = [...history]
    .reverse()
    .filter(r => r[activeMetric] != null)
    .map(r => ({ date: format(new Date(r.recorded_at), 'd MMM'), val: r[activeMetric] }))

  const latest = history[0]
  const prev   = history[1]
  const activeConf = METRICS.find(m => m.key === activeMetric)

  function delta() {
    if (!latest || !prev || !latest[activeMetric] || !prev[activeMetric]) return null
    const d = (latest[activeMetric] - prev[activeMetric]).toFixed(1)
    return d
  }
  const d = delta()

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="brand-label">HOSMAN</div>
        <h1>Metrics</h1>
      </div>

      <div className="page-scroll">
        {/* Log new reading */}
        <div className="section-label mb-8">Log new reading</div>
        <div className="card mb-16">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            {METRICS.map(m => (
              <div key={m.key}>
                <label className="input-label">{m.label} ({m.unit})</label>
                <input className="input" type="number" step="0.1"
                  placeholder="—" value={form[m.key]}
                  onChange={e => setForm(f => ({ ...f, [m.key]: e.target.value }))}
                  style={{ padding: '10px 10px', fontSize: 14 }} />
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveReading} disabled={saving}>
            {saving ? 'Saving…' : 'Save reading'}
          </button>
        </div>

        {/* Chart */}
        {chartData.length > 1 && (
          <>
            <div className="section-label mb-8">Progress</div>
            <div className="card mb-16">
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {METRICS.map(m => (
                  <button key={m.key}
                    className={`tag ${activeMetric === m.key ? 'tag-gold' : 'tag-muted'}`}
                    style={{ cursor: 'pointer', border: 'none' }}
                    onClick={() => setActive(m.key)}>
                    {m.label}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface2)', border: '0.5px solid var(--border2)', borderRadius: 8, fontSize: 12, fontFamily: 'Montserrat, sans-serif' }}
                    labelStyle={{ color: 'var(--text3)' }}
                    itemStyle={{ color: activeConf.color }}
                    formatter={v => [`${v} ${activeConf.unit}`, activeConf.label]}
                  />
                  <Line type="monotone" dataKey="val" stroke={activeConf.color} strokeWidth={2} dot={{ fill: activeConf.color, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
              {d !== null && (
                <div style={{ textAlign: 'right', fontSize: 11, color: parseFloat(d) < 0 ? 'var(--green)' : 'var(--red)', marginTop: 6 }}>
                  {parseFloat(d) > 0 ? '↑' : '↓'} {Math.abs(d)} {activeConf.unit} since last reading
                </div>
              )}
            </div>
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <div className="section-label mb-8">History</div>
            <div className="card">
              {history.slice(0, 20).map(r => (
                <div key={r.id} className="hist-row">
                  <div className="hist-date">{format(new Date(r.recorded_at), 'd MMM yyyy')}</div>
                  <div className="hist-vals">
                    {r.weight_kg    != null && <div className="hist-val">{r.weight_kg} kg<span>Weight</span></div>}
                    {r.smm_kg       != null && <div className="hist-val">{r.smm_kg} kg<span>SMM</span></div>}
                    {r.body_fat_pct != null && <div className="hist-val">{r.body_fat_pct}%<span>BF</span></div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  )
}
