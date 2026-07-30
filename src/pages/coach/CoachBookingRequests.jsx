import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

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

export default function CoachBookingRequests({ clients }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data: reqs } = await supabase
        .from('booking_requests')
        .select('*')
        .order('created_at', { ascending: false })

      const clientIds = [...new Set((reqs || []).map(r => r.client_id))]
      let profileMap = {}
      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', clientIds)
        profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      }

      const data = (reqs || []).map(r => ({ ...r, profiles: profileMap[r.client_id] || null }))
      setRequests(data)
    } catch (e) {
      console.error('Failed to load requests:', e)
    }
    setLoading(false)
  }

  async function confirm(request) {
    try {
      await supabase.from('booking_requests').update({ status: 'confirmed' }).eq('id', request.id)

      const { data: session } = await supabase.from('scheduled_sessions').insert({
        client_id: request.client_id,
        title: 'Session with Hasan',
        starts_at: request.requested_at,
        duration_min: request.duration_min,
        type: 'coached',
        status: 'scheduled',
        created_by: request.client_id
      }).select().single()

      const clientEmail = request.profiles?.email
      const clientName = request.profiles?.full_name
      if (clientEmail && session) {
        await sendCalendarInvite(session, clientEmail, clientName, false)
      }

      toast.success('Request confirmed — client notified')
      load()
    } catch (e) {
      toast.error('Failed to confirm')
      console.error(e)
    }
  }

  async function decline(request) {
    if (!window.confirm(`Decline ${request.profiles?.full_name}'s request?`)) return
    try {
      await supabase.from('booking_requests').update({ status: 'declined' }).eq('id', request.id)
      toast.success('Request declined')
      load()
    } catch (e) {
      toast.error('Failed to decline')
    }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const past    = requests.filter(r => r.status !== 'pending')

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Booking Requests</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Session requests from clients</div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          {pending.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 24, textAlign: 'center', paddingTop: 20 }}>
              No pending requests
            </div>
          ) : (
            <div style={{ marginBottom: 28 }}>
              <div className="section-label mb-8">Pending ({pending.length})</div>
              {pending.map(r => (
                <div key={r.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{r.profiles?.full_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.profiles?.email}</div>
                    </div>
                    <span className="tag tag-gold">Pending</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
                    📅 {format(new Date(r.requested_at), 'EEE d MMM yyyy')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
                    🕐 {format(new Date(r.requested_at), 'HH:mm')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: r.notes ? 4 : 12 }}>
                    ⏱ {r.duration_min} min
                  </div>
                  {r.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, fontStyle: 'italic' }}>
                      "{r.notes}"
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-gold btn-sm" style={{ flex: 1 }} onClick={() => confirm(r)}>
                      Confirm
                    </button>
                    <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => decline(r)}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div>
              <div className="section-label mb-8">Past requests</div>
              {past.map(r => (
                <div key={r.id} className="sched-item" style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 52 }}>
                    {format(new Date(r.requested_at), 'd MMM')}
                  </div>
                  <div className={`sched-dot ${r.status === 'confirmed' ? 'dot-green' : 'dot-muted'}`} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{r.profiles?.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {format(new Date(r.requested_at), 'HH:mm')} · {r.duration_min} min
                    </div>
                  </div>
                  <span className={`tag ${r.status === 'confirmed' ? 'tag-green' : 'tag-muted'}`}>
                    {r.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}