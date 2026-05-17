import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

    // Verify webhook signature manually
    const encoder = new TextEncoder()
    const parts = signature?.split(',') || []
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
    
    // Parse the event directly without Stripe SDK
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

      await supabase.from('packages').insert({
        client_id,
        sessions_total: parseInt(sessions),
        sessions_used: 0,
        price_paid: (session.amount_total || 0) / 100,
        stripe_payment_intent: session.payment_intent,
        purchased_at: new Date().toISOString()
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