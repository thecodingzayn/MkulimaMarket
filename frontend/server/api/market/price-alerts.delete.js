import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    config.supabaseServiceKey
  )

  const { id } = body
  const { error } = await supabase.from('price_alerts').delete().eq('id', id)
  if (error) throw createError({ statusCode: 400, message: error.message })
  return { success: true }
})