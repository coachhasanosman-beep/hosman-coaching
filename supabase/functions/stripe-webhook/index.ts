import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    const event = JSON.parse(body)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const { client_id, sessions } = session.metadata || {}

      if (!client_id || !sessions) {
        return new Response('Missing metadata', { status: 400 })
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      // Credit sessions
      await supabase.from('packages').insert({
        client_id,
        sessions_total: parseInt(sessions),
        sessions_used: 0,
        price_paid: (session.amount_total || 0) / 100,
        stripe_payment_intent: session.payment_intent,
        purchased_at: new Date().toISOString()
      })

      // Get client details
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', client_id)
        .single()

      // Email you
      const resendKey = Deno.env.get('RESEND_API_KEY')!
      const coachEmail = Deno.env.get('COACH_EMAIL')!
      const amount = ((session.amount_total || 0) / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: 'HOSMAN Coaching <noreply@hosmancoaching.com>',
          to: [coachEmail],
          subject: `New package purchase — ${profile?.full_name}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
              <div style="background:#1a1a1a;padding:24px;text-align:center">
                <h1 style="color:#c9a96e;font-size:20px;letter-spacing:0.15em;margin:0">HOSMAN</h1>
                <p style="color:#888;font-size:11px;letter-spacing:0.1em;margin:4px 0 0">PREMIUM COACHING</p>
              </div>
              <div style="padding:32px 24px">
                <h2 style="margin:0 0 16px">New package purchased</h2>
                <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:20px 0">
                  <p style="margin:0 0 8px"><strong>Client:</strong> ${profile?.full_name}</p>
                  <p style="margin:0 0 8px"><strong>Email:</strong> ${profile?.email}</p>
                  <p style="margin:0 0 8px"><strong>Sessions:</strong> ${sessions}</p>
                  <p style="margin:0"><strong>Amount:</strong> ${amount}</p>
                </div>
                <p style="color:#888;font-size:12px;margin-top:24px">HOSMAN Premium Coaching</p>
              </div>
            </div>
          `
        })
      })

      console.log(`Credited ${sessions} sessions to client ${client_id}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Webhook error:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})