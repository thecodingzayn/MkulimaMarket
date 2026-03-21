import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Handle Supabase webhook format
  const record = body.record ?? body
  const userId = record.user_id ?? body.userId
  const title = record.title ?? body.title ?? 'MkulimaMarket'
  const notifBody = record.body ?? body.body ?? 'You have a new notification'
  const url = record.link ?? body.url ?? '/'

  if (!userId) return { success: false, reason: 'No user_id' }

  const config = useRuntimeConfig()

  webpush.setVapidDetails(
    config.vapidEmail,
    process.env.VAPID_PUBLIC_KEY!,
    config.vapidPrivateKey
  )

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .single()

  if (!sub?.subscription) return { success: false, reason: 'No subscription found' }

  try {
    await webpush.sendNotification(
      sub.subscription,
      JSON.stringify({ title, body: notifBody, url })
    )
    return { success: true }
  } catch (err: any) {
    if (err.statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId)
    }
    return { success: false, error: err.message }
  }
})