// ── Push notification helpers ─────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export async function subscribeToPush(supabase, clientId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub = existing || await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY || '')
  })

  await supabase.from('notification_prefs').upsert({
    client_id: clientId,
    push_subscription: sub.toJSON()
  }, { onConflict: 'client_id' })
}

// Schedule a local notification (fallback when server push unavailable)
export function scheduleLocalNotification(title, body, fireAt) {
  const msUntil = new Date(fireAt).getTime() - Date.now()
  if (msUntil <= 0) return
  setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'hosman-session'
      })
    }
  }, msUntil)
}

// Schedule 1hr-before reminders for upcoming sessions
export function scheduleSessionReminders(sessions) {
  sessions.forEach(s => {
    if (s.status !== 'scheduled') return
    const fireAt = new Date(s.starts_at).getTime() - 60 * 60 * 1000
    scheduleLocalNotification(
      'Session in 1 hour',
      `${s.title}${s.location ? ' · ' + s.location : ''}`,
      fireAt
    )
  })
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
