import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateICS(session: {
  title: string
  location: string
  starts_at: string
  duration_min: number
  clientEmail: string
  clientName: string
  uid: string
  cancelled?: boolean
}) {
  const start = new Date(session.starts_at)
  const end = new Date(start.getTime() + session.duration_min * 60000)

  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const method = session.cancelled ? 'CANCEL' : 'REQUEST'
  const status = session.cancelled ? 'CANCELLED' : 'CONFIRMED'

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HOSMAN Coaching//EN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${session.uid}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${session.title}`,
    session.location ? `LOCATION:${session.location}` : '',
    `DESCRIPTION:Your session with HOSMAN Coaching`,
    `ORGANIZER;CN=HOSMAN Coaching:mailto:noreply@hosmancoaching.com`,
    `ATTENDEE;CN=${session.clientName};RSVP=TRUE:mailto:${session.clientEmail}`,
    `STATUS:${status}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Session starting in 1 hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { session, clientEmail, clientName, cancelled } = await req.json()

    const ics = generateICS({
      title: session.title,
      location: session.location || '',
      starts_at: session.starts_at,
      duration_min: session.duration_min || 60,
      clientEmail,
      clientName,
      uid: session.id,
      cancelled
    })

    const start = new Date(session.starts_at)
    const dateStr = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

    const subject = cancelled
      ? `Cancelled: ${session.title}`
      : `Session confirmed: ${session.title}`

    const html = cancelled ? `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
        <div style="background:#1a1a1a;padding:24px;text-align:center">
          <h1 style="color:#c9a96e;font-size:20px;letter-spacing:0.15em;margin:0">HOSMAN</h1>
          <p style="color:#888;font-size:11px;letter-spacing:0.1em;margin:4px 0 0">PREMIUM COACHING</p>
        </div>
        <div style="padding:32px 24px">
          <h2 style="margin:0 0 16px">Session cancelled</h2>
          <p>Hi ${clientName},</p>
          <p>Your session <strong>${session.title}</strong> on <strong>${dateStr} at ${timeStr}</strong> has been cancelled.</p>
          ${session.location ? `<p>Location: ${session.location}</p>` : ''}
          <p>Please open the attachment to remove this from your calendar.</p>
          <p style="margin-top:24px;color:#888;font-size:12px">HOSMAN Premium Coaching</p>
        </div>
      </div>` : `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
        <div style="background:#1a1a1a;padding:24px;text-align:center">
          <h1 style="color:#c9a96e;font-size:20px;letter-spacing:0.15em;margin:0">HOSMAN</h1>
          <p style="color:#888;font-size:11px;letter-spacing:0.1em;margin:4px 0 0">PREMIUM COACHING</p>
        </div>
        <div style="padding:32px 24px">
          <h2 style="margin:0 0 16px">Session confirmed</h2>
          <p>Hi ${clientName},</p>
          <p>Your session has been scheduled:</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0 0 8px"><strong>${session.title}</strong></p>
            <p style="margin:0 0 4px;color:#666">📅 ${dateStr}</p>
            <p style="margin:0 0 4px;color:#666">🕐 ${timeStr}</p>
            ${session.location ? `<p style="margin:0;color:#666">📍 ${session.location}</p>` : ''}
          </div>
          <p>Open the attached file to add this to your calendar.</p>
          <p style="margin-top:24px;color:#888;font-size:12px">HOSMAN Premium Coaching · 24-hour cancellation policy applies</p>
        </div>
      </div>`

    const resendKey = Deno.env.get('RESEND_API_KEY')!

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`
      },
      body: JSON.stringify({
        from: 'HOSMAN Coaching <noreply@hosmancoaching.com>',
        to: [clientEmail],
        subject,
        html,
        attachments: [{
          filename: 'session.ics',
          content: btoa(ics)
        }]
      })
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(err)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Calendar invite error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})