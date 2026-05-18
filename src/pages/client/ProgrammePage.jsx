import { useEffect, useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const WEEK_COUNT = 6

export default function ProgrammePage({ clientId: propClientId }) {
  const { profile, isCoach } = useAuth()
  const clientId = propClientId || profile?.id

  const [programmes, setProgrammes] = useState([])
  const [activeProg, setActiveProg] = useState(null)
  const [sessions, setSessions]     = useState([])
  const [activeTab, setActiveTab]   = useState(0)
  const [renaming, setRenaming]     = useState(null)
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)
  const [creatingBlock, setCreatingBlock] = useState(false)
  const saveTimer = useRef(null)
  const dragSrc   = useRef(null)

  useEffect(() => { if (clientId) loadProgrammes() }, [clientId])

  async function loadProgrammes() {
    setLoading(true)
    const { data: progs } = await supabase
      .from('programmes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })

    if (!progs || progs.length === 0) {
      const { data } = await supabase.from('programmes')
        .insert({ client_id: clientId, title: 'Block 1' })
        .select().single()
      setProgrammes([data])
      setActiveProg(data)
      await loadSessions(data)
    } else {
      setProgrammes(progs)
      const latest = progs[progs.length - 1]
      setActiveProg(latest)
      await loadSessions(latest)
    }
    setLoading(false)
  }

  async function loadSessions(prog) {
    const { data: sess } = await supabase
      .from('programme_sessions')
      .select('*, exercises(*)')
      .eq('programme_id', prog.id)
      .order('position')

    if (!sess || sess.length === 0) {
      await createDefaultSessions(prog.id)
    } else {
      const normalised = sess.map(s => ({
        ...s,
        exercises: (s.exercises || []).sort((a, b) => a.position - b.position).map(e => ({
          ...e,
          week_loads: Array.isArray(e.week_loads) ? e.week_loads : JSON.parse(e.week_loads || '[]')
        }))
      }))
      setSessions(normalised)
      setActiveTab(0)
    }
  }

  async function switchBlock(prog) {
    setActiveProg(prog)
    setSessions([])
    setActiveTab(0)
    await loadSessions(prog)
  }

  async function createNewBlock() {
    setCreatingBlock(true)
    try {
      const nextNum = programmes.length + 1
      const { data } = await supabase.from('programmes')
        .insert({ client_id: clientId, title: `Block ${nextNum}` })
        .select().single()
      const updated = [...programmes, data]
      setProgrammes(updated)
      setActiveProg(data)
      await createDefaultSessions(data.id)
      toast.success(`Block ${nextNum} created`)
    } catch (e) {
      toast.error('Failed to create block')
    } finally {
      setCreatingBlock(false)
    }
  }

  async function deleteBlock(prog) {
    if (programmes.length <= 1) return toast.error('Must have at least one block')
    if (!window.confirm(`Delete ${prog.title}? This cannot be undone.`)) return
    await supabase.from('programmes').delete().eq('id', prog.id)
    const updated = programmes.filter(p => p.id !== prog.id)
    setProgrammes(updated)
    const latest = updated[updated.length - 1]
    setActiveProg(latest)
    await loadSessions(latest)
    toast.success(`${prog.title} deleted`)
  }

  async function createDefaultSessions(programmeId) {
    const defaults = ['Session A', 'Session B', 'Session C', 'Session D']
    const created = []
    for (let i = 0; i < defaults.length; i++) {
      const { data } = await supabase.from('programme_sessions')
        .insert({ programme_id: programmeId, name: defaults[i], position: i })
        .select().single()
      created.push({ ...data, exercises: [] })
    }
    setSessions(created)
    setActiveTab(0)
  }

  const scheduleSave = useCallback((updatedSessions) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistSessions(updatedSessions), 800)
  }, [])

  async function persistSessions(sess) {
    setSaving(true)
    try {
      for (const s of sess) {
        for (const ex of s.exercises) {
          await supabase.from('exercises').upsert({
            id: ex.id,
            programme_session_id: s.id,
            position: ex.position,
            name: ex.name,
            sets_reps: ex.sets_reps,
            notes: ex.notes,
            week_loads: ex.week_loads
          })
        }
        await supabase.from('programme_sessions').update({ name: s.name }).eq('id', s.id)
      }
    } catch (e) {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  function updateSession(fn) {
    setSessions(prev => {
      const updated = fn(prev)
      scheduleSave(updated)
      return updated
    })
  }

  function onCellChange(exIdx, field, value) {
    updateSession(prev => prev.map((s, si) => {
      if (si !== activeTab) return s
      return { ...s, exercises: s.exercises.map((ex, ei) => ei !== exIdx ? ex : { ...ex, [field]: value }) }
    }))
  }

  function onWeekChange(exIdx, weekIdx, value) {
    updateSession(prev => prev.map((s, si) => {
      if (si !== activeTab) return s
      return {
        ...s, exercises: s.exercises.map((ex, ei) => {
          if (ei !== exIdx) return ex
          const wks = [...ex.week_loads]
          wks[weekIdx] = value
          return { ...ex, week_loads: wks }
        })
      }
    }))
  }

  async function addExercise() {
    const sess = sessions[activeTab]
    const { data } = await supabase.from('exercises').insert({
      programme_session_id: sess.id,
      position: sess.exercises.length,
      name: '', sets_reps: '', notes: '',
      week_loads: ['', '', '', '', '', '']
    }).select().single()
    updateSession(prev => prev.map((s, si) => si !== activeTab ? s : {
      ...s, exercises: [...s.exercises, { ...data, week_loads: ['', '', '', '', '', ''] }]
    }))
    setTimeout(() => {
      const inputs = document.querySelectorAll('.ex-name-input')
      inputs[inputs.length - 1]?.focus()
    }, 50)
  }

  async function deleteExercise(exIdx) {
    const ex = sessions[activeTab].exercises[exIdx]
    await supabase.from('exercises').delete().eq('id', ex.id)
    updateSession(prev => prev.map((s, si) => si !== activeTab ? s : {
      ...s, exercises: s.exercises.filter((_, ei) => ei !== exIdx).map((e, i) => ({ ...e, position: i }))
    }))
  }

  async function addSession() {
    if (sessions.length >= 7) return
    const labels = ['A','B','C','D','E','F','G']
    const name = `Session ${labels[sessions.length] || sessions.length + 1}`
    const { data } = await supabase.from('programme_sessions').insert({
      programme_id: activeProg.id, name, position: sessions.length
    }).select().single()
    setSessions(prev => [...prev, { ...data, exercises: [] }])
    setActiveTab(sessions.length)
  }

  async function deleteSession(idx) {
    if (sessions.length <= 1) return toast.error('Must have at least one session')
    const sess = sessions[idx]
    await supabase.from('programme_sessions').delete().eq('id', sess.id)
    setSessions(prev => prev.filter((_, i) => i !== idx))
    setActiveTab(0)
  }

  function startRename(idx) { setRenaming(idx) }
  async function finishRename(idx, value) {
    setRenaming(null)
    const name = value.trim().toUpperCase() || sessions[idx].name
    updateSession(prev => prev.map((s, i) => i !== idx ? s : { ...s, name }))
  }

  function onDragStart(idx) { dragSrc.current = idx }
  function onDrop(targetIdx) {
    if (dragSrc.current === null || dragSrc.current === targetIdx) return
    updateSession(prev => prev.map((s, si) => {
      if (si !== activeTab) return s
      const exs = [...s.exercises]
      const [moved] = exs.splice(dragSrc.current, 1)
      exs.splice(targetIdx, 0, moved)
      return { ...s, exercises: exs.map((e, i) => ({ ...e, position: i })) }
    }))
    dragSrc.current = null
  }

  if (loading) return <div className="spinner">Loading programme…</div>
  const curr = sessions[activeTab]

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ paddingBottom: 8 }}>
        <div className="brand-label">HOSMAN</div>
        <div className="row">
          <h1>Programme</h1>
          <span style={{ fontSize: 11, color: saving ? 'var(--gold)' : 'var(--text3)', letterSpacing: '0.06em' }}>
            {saving ? 'Saving…' : 'Auto-saved'}
          </span>
        </div>
      </div>

      {/* Block selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px 10px', flexShrink: 0, overflowX: 'auto' }}>
        {programmes.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <button
              onClick={() => switchBlock(p)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                letterSpacing: '0.06em', cursor: 'pointer',
                background: activeProg?.id === p.id ? 'var(--gold)' : 'var(--surface2)',
                color: activeProg?.id === p.id ? '#1a1a1a' : 'var(--text3)',
                border: 'none', fontFamily: 'Montserrat, sans-serif'
              }}>
              {p.title.toUpperCase()}
            </button>
            {isCoach && programmes.length > 1 && (
              <button
                onClick={() => deleteBlock(p)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text3)',
                  cursor: 'pointer', fontSize: 11, padding: '0 2px', opacity: 0.5, lineHeight: 1
                }}>
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {isCoach && (
          <button
            onClick={createNewBlock}
            disabled={creatingBlock}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.06em', cursor: 'pointer', flexShrink: 0,
              background: 'transparent', color: 'var(--text3)',
              border: '0.5px dashed var(--border2)', fontFamily: 'Montserrat, sans-serif',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
            <i className="ti ti-plus" style={{ fontSize: 12 }} /> {creatingBlock ? 'Creating…' : 'New block'}
          </button>
        )}
      </div>

      {/* Session tabs */}
      <div className="tab-bar">
        {sessions.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button
              className={`tab-btn ${i === activeTab ? 'active' : ''}`}
              onClick={() => setActiveTab(i)}
              onDoubleClick={() => startRename(i)}>
              {renaming === i
                ? <input autoFocus className="tab-rename"
                    defaultValue={s.name}
                    onBlur={e => finishRename(i, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') finishRename(i, e.target.value) }}
                    onClick={e => e.stopPropagation()} />
                : s.name
              }
            </button>
            {sessions.length > 1 && (
              <button
                onClick={() => deleteSession(i)}
                title="Delete session"
                style={{
                  background: 'none', border: 'none', color: 'var(--text3)',
                  cursor: 'pointer', fontSize: 12, padding: '0 6px 0 0', opacity: 0.5, lineHeight: 1
                }}>
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {sessions.length < 7 && (
          <button className="tab-btn" onClick={addSession} title="Add session" style={{ padding: '10px 8px' }}>
            <i className="ti ti-plus" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        )}
      </div>

      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em', padding: '6px 20px 4px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <i className="ti ti-pencil" style={{ fontSize: 11 }} aria-hidden="true" />
        Tap any cell to edit · Drag <i className="ti ti-grip-vertical" style={{ fontSize: 11 }} aria-hidden="true" /> to reorder · Double-tap tab to rename · × to delete tab
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="prog-wrap" style={{ height: '100%', overflowY: 'auto', overflowX: 'auto', padding: '0 20px', marginBottom: 0 }}>
          <table className="prog-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: 22 }}></th>
                <th style={{ minWidth: 120 }}>Exercise</th>
                <th style={{ minWidth: 80 }}>Sets × Reps</th>
                <th style={{ minWidth: 76 }}>Notes</th>
                {Array.from({ length: WEEK_COUNT }, (_, i) => (
                  <th key={i} style={{ minWidth: 56 }}>Wk {i + 1}</th>
                ))}
                <th style={{ width: 24 }}></th>
              </tr>
            </thead>
            <tbody>
              {curr?.exercises.map((ex, ei) => (
                <tr key={ex.id}
                  draggable
                  onDragStart={() => onDragStart(ei)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => onDrop(ei)}>
                  <td>
                    <span className="drag-handle">
                      <i className="ti ti-grip-vertical" aria-hidden="true" />
                    </span>
                  </td>
                  <td>
                    <input className="cell-input ex ex-name-input"
                      value={ex.name} placeholder="Exercise name"
                      onChange={e => onCellChange(ei, 'name', e.target.value)} />
                  </td>
                  <td>
                    <input className="cell-input"
                      value={ex.sets_reps} placeholder="e.g. 3×8"
                      onChange={e => onCellChange(ei, 'sets_reps', e.target.value)} />
                  </td>
                  <td>
                    <input className="cell-input"
                      value={ex.notes} placeholder="—"
                      onChange={e => onCellChange(ei, 'notes', e.target.value)} />
                  </td>
                  {Array.from({ length: WEEK_COUNT }, (_, wi) => (
                    <td key={wi}>
                      <input className="cell-input"
                        value={ex.week_loads[wi] || ''} placeholder="—"
                        onChange={e => onWeekChange(ei, wi, e.target.value)} />
                    </td>
                  ))}
                  <td>
                    <button className="delete-row-btn" onClick={() => deleteExercise(ei)} title="Remove exercise">
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={addExercise} style={{
            background: 'var(--surface2)', border: '0.5px dashed var(--border2)',
            borderRadius: 8, padding: '9px 14px', color: 'var(--text3)', fontSize: 12,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            margin: '10px 0', fontFamily: 'Montserrat, sans-serif', width: '100%'
          }}>
            <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> Add exercise
          </button>
          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  )
}