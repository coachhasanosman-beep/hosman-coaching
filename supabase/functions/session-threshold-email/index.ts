import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { clientEmail, clientName, remaining, packageSize } = await req.json()

    const isSingleSession = packageSize === 1
    const appUrl = 'https://hosman-coaching.vercel.app/app/sessions'
    const resendKey = Deno.env.get('RESEND_API_KEY')!

    let subject = ''
    let bodyContent = ''
    let shouldSend = false

    if (remaining === 3 && !isSingleSession) {
      shouldSend = true
      subject = 'You have 3 sessions remaining'
      bodyContent = `
        <p>Hi ${clientName},</p>
        <p>Just a heads up — you have <strong>3 sessions remaining</strong> on your current package.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${appUrl}" style="background:#c9a96e;color:#1a1a1a;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.06em">
            PURCHASE SESSIONS
          </a>
        </div>
        <p style="color:#aaa;font-size:11px;text-align:center">${appUrl}</p>
      `
    } else if (remaining === 0 && !isSingleSession) {
      shouldSend = true
      subject = "You've used all your sessions"
      bodyContent = `
        <p>Hi ${clientName},</p>
        <p>You've used all the sessions on your current package.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${appUrl}" style="background:#c9a96e;color:#1a1a1a;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.06em">
            PURCHASE SESSIONS
          </a>
        </div>
        <p style="color:#aaa;font-size:11px;text-align:center">${appUrl}</p>
      `
    } else if (remaining < 0) {
      shouldSend = true
      subject = 'Outstanding session balance'
      bodyContent = `
        <p>Hi ${clientName},</p>
        <p>You have an outstanding session — please purchase a package to settle your balance.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${appUrl}" style="background:#c9a96e;color:#1a1a1a;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.06em">
            PURCHASE SESSIONS
          </a>
        </div>
        <p style="color:#aaa;font-size:11px;text-align:center">${appUrl}</p>
      `
    }

    if (!shouldSend) {
      return new Response(JSON.stringify({ sent: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
        <div style="background:#1a1a1a;padding:24px;text-align:center">
          <h1 style="color:#c9a96e;font-size:20px;letter-spacing:0.15em;margin:0">HOSMAN</h1>
          <p style="color:#888;font-size:11px;letter-spacing:0.1em;margin:4px 0 0">PREMIUM COACHING</p>
        </div>
        <div style="padding:32px 24px">
          ${bodyContent}
          <p style="margin-top:24px;color:#888;font-size:12px">HOSMAN Premium Coaching</p>
        </div>
      </div>
    `

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`
      },
      body: JSON.stringify({
        from: 'HOSMAN Coaching <noreply@hosmancoaching.com>',
        to: [clientEmail],
        subject,
        html
      })
    })

    return new Response(JSON.stringify({ sent: true, subject }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Threshold email error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})