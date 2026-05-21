import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'coach') return new Response('Forbidden', { status: 403, headers: corsHeaders })

    const { email, full_name } = await req.json()
    const resendKey = Deno.env.get('RESEND_API_KEY')!

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`
      },
      body: JSON.stringify({
        from: 'HOSMAN Coaching <noreply@hosmancoaching.com>',
        to: [email],
        subject: 'Your HOSMAN Coaching app access',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
            <div style="background:#1a1a1a;padding:24px;text-align:center">
              <h1 style="color:#c9a96e;font-size:20px;letter-spacing:0.15em;margin:0">HOSMAN</h1>
              <p style="color:#888;font-size:11px;letter-spacing:0.1em;margin:4px 0 0">PREMIUM COACHING</p>
            </div>
            <div style="padding:32px 24px">
              <h2 style="margin:0 0 16px">Hi ${full_name},</h2>
              <p>Here's a reminder of how to access your HOSMAN Coaching app.</p>
              <div style="text-align:center;margin:28px 0">
                <a href="https://hosman-coaching.vercel.app"
                  style="background:#c9a96e;color:#1a1a1a;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.06em">
                  OPEN APP
                </a>
              </div>
              <p style="color:#888;font-size:12px;text-align:center">
                Log in with your email address at:<br/>
                <span style="color:#c9a96e">https://hosman-coaching.vercel.app</span>
              </p>
              <p style="color:#888;font-size:12px;text-align:center;margin-top:8px">
                If you've forgotten your password, use the "Forgot password?" link on the login page.
              </p>
              <p style="margin-top:24px;color:#888;font-size:12px">HOSMAN Premium Coaching</p>
            </div>
          </div>
        `
      })
    })

    if (!res.ok) throw new Error(await res.text())

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})