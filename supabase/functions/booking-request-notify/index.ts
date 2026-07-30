import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { clientName, clientEmail, requestedAt, duration, notes } = await req.json()

    const resendKey = Deno.env.get('RESEND_API_KEY')!
    const coachEmail = Deno.env.get('COACH_EMAIL')!

    const date = new Date(requestedAt)
    const dateStr = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`
      },
      body: JSON.stringify({
        from: 'HOSMAN Coaching <noreply@hosmancoaching.com>',
        to: [coachEmail],
        subject: `New session request — ${clientName}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
            <div style="background:#1a1a1a;padding:24px;text-align:center">
              <h1 style="color:#c9a96e;font-size:20px;letter-spacing:0.15em;margin:0">HOSMAN</h1>
              <p style="color:#888;font-size:11px;letter-spacing:0.1em;margin:4px 0 0">PREMIUM COACHING</p>
            </div>
            <div style="padding:32px 24px">
              <h2 style="margin:0 0 16px">New session request</h2>
              <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:20px 0">
                <p style="margin:0 0 8px"><strong>Client:</strong> ${clientName}</p>
                <p style="margin:0 0 8px"><strong>Email:</strong> ${clientEmail}</p>
                <p style="margin:0 0 8px"><strong>Requested date:</strong> ${dateStr}</p>
                <p style="margin:0 0 8px"><strong>Requested time:</strong> ${timeStr}</p>
                <p style="margin:0 0 8px"><strong>Duration:</strong> ${duration} min</p>
                ${notes ? `<p style="margin:0"><strong>Notes:</strong> ${notes}</p>` : ''}
              </div>
              <p>Log in to your coach dashboard to confirm or decline this request.</p>
              <div style="text-align:center;margin:28px 0">
                <a href="https://hosman-coaching.vercel.app/coach"
                  style="background:#c9a96e;color:#1a1a1a;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.06em">
                  OPEN DASHBOARD
                </a>
              </div>
              <p style="color:#888;font-size:12px;margin-top:24px">HOSMAN Premium Coaching</p>
            </div>
          </div>
        `
      })
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})