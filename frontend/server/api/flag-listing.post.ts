import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const { productId, title, ownerId } = await readBody(event)

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  await supabase
    .from('products')
    .update({
      status: 'reviewing',
      review_reason: 'flagged_unavailable'
    })
    .eq('id', productId)

  await supabase.from('notifications').insert({
    user_id: ownerId,
    type: 'unavailable_report',
    title: '⚠️ Your listing has been flagged',
    body: `A user flagged "${title}" as unavailable. It is now under review.`,
    link: `/listings/${productId}`,
    read: false
  })

  await $fetch('/api/send-push', {
  method: 'POST',
  body: {
    userId: ownerId,
    title: '⚠️ Your listing has been flagged',
    body: `A user flagged "${title}" as unavailable.`,
    url: `/listings/${productId}`
  }
})

  return { success: true }
})