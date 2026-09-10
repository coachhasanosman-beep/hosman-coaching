import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { clientEmail, clientName, personalNote, sectionsData, summary, clientId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Save recap to database
    await supabase.from('recaps').insert({
      client_id: clientId,
      title: 'Training in Review',
      sections: sectionsData,
      summary,
      personal_note: personalNote
    })

    // Send notification email
    const resendKey = Deno.env.get('RESEND_API_KEY')!
    console.log('Resend key present:', !!resendKey)

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`
      },
      body: JSON.stringify({
        from: 'HOSMAN Coaching <noreply@hosmancoaching.com>',
        to: [clientEmail],
        subject: 'Your Training in Review is ready',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
            <div style="background:#1a1a1a;padding:24px;text-align:center">
              <h1 style="color:#c9a96e;font-size:20px;letter-spacing:0.15em;margin:0">HOSMAN</h1>
              <p style="color:#888;font-size:11px;letter-spacing:0.1em;margin:4px 0 0">PREMIUM COACHING</p>
            </div>
            <div style="padding:32px 24px">
              <h2 style="margin:0 0 16px">Your Training in Review is ready</h2>
              <p>Hi ${clientName},</p>
              <p>Your coach has put together a review of your training progress. Open the app to see your full breakdown including session stats, load progression charts and more.</p>
              ${personalNote ? `<div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0 0 6px;font-weight:600">A note from Hasan:</p><p style="margin:0">${personalNote}</p></div>` : ''}
              <div style="text-align:center;margin:28px 0">
                <a href="https://hosman-coaching.vercel.app"
                  style="background:#c9a96e;color:#1a1a1a;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.06em">
                  VIEW IN APP
                </a>
              </div>
              <p style="color:#888;font-size:12px;margin-top:24px">HOSMAN Premium Coaching</p>
            </div>
          </div>
        `
      })
    })

    if (!emailRes.ok) {
      const err = await emailRes.text()
      console.error('Resend error:', err)
      throw new Error(err)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Send recap error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})