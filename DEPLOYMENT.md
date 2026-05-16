# HOSMAN Coaching App — Deployment Guide

## Overview
Stack: React + Vite PWA · Supabase (auth + database) · Stripe (payments) · Vercel (hosting)

---

## Step 1 — Supabase setup (15 min)

1. Go to https://supabase.com → New project
   - Name: hosman-coaching
   - Database password: save this somewhere safe
   - Region: West EU (London)

2. Once created, go to **SQL Editor** and paste the entire contents of `supabase-schema.sql` → Run

3. Go to **Settings → API** and copy:
   - Project URL → `VITE_SUPABASE_URL`
   - anon/public key → `VITE_SUPABASE_ANON_KEY`
   - service_role key → needed for edge functions (keep secret, never in frontend)

4. Go to **Auth → Settings**:
   - Site URL: `https://your-app.vercel.app` (update after Vercel deploy)
   - Redirect URLs: add `https://your-app.vercel.app/auth/callback`
   - Enable Email provider (on by default)

5. Enable OAuth (optional but recommended):
   - Auth → Providers → Google: add your Google OAuth credentials
   - Auth → Providers → Apple: add your Apple credentials

6. **Create your coach account:**
   - Go to Auth → Users → Invite user → enter YOUR email
   - Check your email, set your password
   - Go to SQL Editor and run:
     ```sql
     update profiles set role = 'coach' where email = 'YOUR_EMAIL_HERE';
     ```

---

## Step 2 — Stripe setup (10 min)

You already have a Stripe account. Do the following:

1. Go to **Products → Add product** and create 4 products:

   | Name | Price | Type |
   |------|-------|------|
   | Single session | £140.00 | One-time |
   | 12 sessions | £1,620.00 | One-time |
   | 24 sessions | £3,120.00 | One-time |
   | 48 sessions | £6,000.00 | One-time |

2. Copy the **Price ID** (starts with `price_`) for each product into your `.env`

3. Go to **Developers → API Keys** and copy the publishable key (`pk_live_...`) → `VITE_STRIPE_PUBLISHABLE_KEY`

4. Keep your secret key (`sk_live_...`) for the edge functions (set as Supabase secret, not in frontend)

5. **Apple Pay / Google Pay:** these are enabled automatically in Stripe Checkout when on HTTPS

---

## Step 3 — Deploy to Vercel (5 min)

1. Push this project to a GitHub repo

2. Go to https://vercel.com → Import project from GitHub

3. Framework: **Vite**

4. Add environment variables (from your `.env.example`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRIPE_PUBLISHABLE_KEY`
   - `VITE_STRIPE_PRICE_SINGLE`, `VITE_STRIPE_PRICE_12`, `VITE_STRIPE_PRICE_24`, `VITE_STRIPE_PRICE_48`
   - `VITE_APP_URL` = your Vercel URL (e.g. `https://hosman-coaching.vercel.app`)

5. Deploy → copy the URL → update Supabase Auth redirect URLs

---

## Step 4 — Supabase Edge Functions (10 min)

Install Supabase CLI: `npm install -g supabase`

```bash
cd hosman
supabase login
supabase link --project-ref YOUR_PROJECT_ID
```

Set secrets for your functions:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_KEY
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
supabase secrets set APP_URL=https://your-app.vercel.app
```

Deploy the three functions:
```bash
supabase functions deploy invite-client
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

---

## Step 5 — Stripe Webhook (5 min)

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/stripe-webhook`
3. Events to listen for: `checkout.session.completed`
4. Copy the **Webhook signing secret** → `STRIPE_WEBHOOK_SECRET` (set via Supabase secrets above)

---

## Step 6 — Install to phone as PWA

**iOS (Safari):**
1. Open your Vercel URL in Safari
2. Tap the share button → "Add to Home Screen"
3. Tap Add → app appears on home screen

**Android (Chrome):**
1. Open your Vercel URL in Chrome
2. Tap the three-dot menu → "Install app" / "Add to Home Screen"

**Notifications on iOS:**
- iOS 16.4+ required for push notifications
- When client first opens the app, prompt them to allow notifications

---

## Custom domain (optional)

1. Vercel → Settings → Domains → Add `app.hosman.co.uk` (or similar)
2. Update your DNS records as instructed
3. Update Supabase redirect URLs and `VITE_APP_URL`

---

## Running locally for development

```bash
cd hosman
cp .env.example .env
# Fill in your .env values
npm install
npm run dev
```

Open http://localhost:5173

---

## Project structure

```
hosman/
├── src/
│   ├── pages/
│   │   ├── client/           ← All client-facing screens
│   │   │   ├── HomePage.jsx
│   │   │   ├── ProgrammePage.jsx
│   │   │   ├── SchedulePage.jsx
│   │   │   ├── SessionsPage.jsx
│   │   │   └── MetricsPage.jsx
│   │   ├── coach/            ← Coach dashboard
│   │   │   ├── CoachApp.jsx
│   │   │   ├── CoachOverview.jsx
│   │   │   ├── CoachClientView.jsx
│   │   │   └── CoachSessionManager.jsx
│   │   ├── LoginPage.jsx
│   │   └── AuthCallback.jsx
│   ├── components/shared/
│   │   └── BottomNav.jsx
│   ├── hooks/
│   │   └── useAuth.jsx
│   ├── lib/
│   │   ├── supabase.js       ← DB + auth client
│   │   ├── stripe.js         ← Stripe + package config
│   │   └── notifications.js  ← Push notification helpers
│   └── styles/
│       └── global.css        ← Full design system
├── supabase/
│   └── functions/
│       ├── invite-client/    ← Sends magic link invite
│       ├── create-checkout/  ← Creates Stripe session
│       └── stripe-webhook/   ← Credits sessions after payment
├── supabase-schema.sql       ← Full DB schema + RLS policies
├── .env.example              ← Environment variable template
└── vite.config.js            ← PWA configuration
```
