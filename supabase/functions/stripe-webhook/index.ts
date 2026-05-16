// supabase/functions/stripe-webhook/index.ts
// Deploy: supabase functions deploy stripe-webhook
// Register in Stripe Dashboard > Webhooks > Add endpoint
// URL: https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook
// Events: checkout.session.completed

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { client_id, sessions } = session.metadata!

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Credit sessions to client
    await supabase.from('packages').insert({
      client_id,
      sessions_total: parseInt(sessions),
      sessions_used: 0,
      price_paid: (session.amount_total || 0) / 100,
      stripe_payment_intent: session.payment_intent as string,
      purchased_at: new Date().toISOString()
    })

    console.log(`Credited ${sessions} sessions to client ${client_id}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
