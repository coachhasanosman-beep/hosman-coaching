import { useState } from 'react'
import { supabase, signOut } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { profile } = useAuth()
  const [name, setName]         = useState(profile?.full_name || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)

  async function updateName() {
    setSaving(true)
    try {
      await supabase.from('profiles').update({ full_name: name }).eq('id', profile.id)
      await supabase.auth.updateUser({ data: { full_name: name } })
      toast.success('Name updated')
    } catch (e) {
      toast.error('Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  async function updatePassword() {
    if (!password) return toast.error('Enter a new password')
    if (password !== confirm) return toast.error('Passwords do not match')
    if (password.length < 8) return toast.error('Password must be at least 8 characters')
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Password updated')
      setPassword('')
      setConfirm('')
    } catch (e) {
      toast.error(e.message || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  function initials(name) {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="brand-label">HOSMAN</div>
        <h1>Settings</h1>
      </div>
      <div className="page-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 24 }}>
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 22, marginBottom: 12 }}>
            {initials(profile?.full_name)}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{profile?.full_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{profile?.email}</div>
        </div>
        <div className="section-label mb-8">Display name</div>
        <div className="card mb-16">
          <div className="mb-12">
            <label className="input-label">Full name</label>
            <input className="input" value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={updateName} disabled={saving}>
            Save name
          </button>
        </div>
        <div className="section-label mb-8">Change password</div>
        <div className="card mb-16">
          <div className="mb-12">
            <label className="input-label">New password</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters" />
          </div>
          <div className="mb-12">
            <label className="input-label">Confirm password</label>
            <input className="input" type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat new password" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={updatePassword} disabled={saving}>
            Update password
          </button>
        </div>
        <div className="section-label mb-8">Account</div>
        <div className="card mb-16">
          <button className="btn btn-ghost" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>
  )
}