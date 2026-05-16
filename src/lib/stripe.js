import { loadStripe } from '@stripe/stripe-js'
import { supabase } from './supabase'

let stripePromise
export const getStripe = () => {
  if (!stripePromise) stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  return stripePromise
}

export const PACKAGES = [
  {
    id: 'single',
    label: 'Single session',
    sessions: 1,
    price: 14000,       // pence
    priceDisplay: '£140',
    perSession: '£140 per session',
    saving: null,
    priceEnvKey: 'VITE_STRIPE_PRICE_SINGLE'
  },
  {
    id: '12',
    label: '12 sessions',
    sessions: 12,
    price: 162000,
    priceDisplay: '£1,620',
    perSession: '£135 per session',
    saving: 'Save £60',
    priceEnvKey: 'VITE_STRIPE_PRICE_12'
  },
  {
    id: '24',
    label: '24 sessions',
    sessions: 24,
    price: 312000,
    priceDisplay: '£3,120',
    perSession: '£130 per session',
    saving: 'Save £240',
    priceEnvKey: 'VITE_STRIPE_PRICE_24'
  },
  {
    id: '48',
    label: '48 sessions',
    sessions: 48,
    price: 600000,
    priceDisplay: '£6,000',
    perSession: '£125 per session',
    saving: 'Save £720',
    priceEnvKey: 'VITE_STRIPE_PRICE_48'
  }
]

// Creates a Stripe Checkout session via Supabase Edge Function
export async function createCheckoutSession(packageId, clientId) {
  const { data: { session } } = await supabase.auth.getSession()
  const pkg = PACKAGES.find(p => p.id === packageId)
  if (!pkg) throw new Error('Unknown package')

  const priceId = import.meta.env[pkg.priceEnvKey]

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ price_id: priceId, client_id: clientId, package_id: packageId, sessions: pkg.sessions })
  })

  if (!res.ok) throw new Error(await res.text())
  const { url } = await res.json()
  window.location.href = url
}
