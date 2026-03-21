export default defineNuxtPlugin(async () => {
 
  
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    
    return
  }

  const supabase = useSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
if (!user) {  return
}

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Check existing permission
    if (Notification.permission === 'denied') return

    // Request permission if not granted
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
    }

    // Get push subscription
    const config = useRuntimeConfig()
    const vapidPublicKey = config.public.vapidPublicKey

    const existing = await registration.pushManager.getSubscription()
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    })

    // Save subscription to Supabase
    await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      subscription: JSON.parse(JSON.stringify(subscription))
    }, { onConflict: 'user_id' })

  } catch (err) {
    console.error('Push notification setup failed:', err)
  }
})

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}