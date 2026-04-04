import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    config.supabaseServiceKey
  )

  const { user_id, category, target_price, direction } = body

  const { data, error } = await supabase
    .from('price_alerts')
    .upsert(
      { user_id, category, target_price, direction, active: true },
      { onConflict: 'user_id,category,direction' }
    )
    .select()
    .single()

  if (error) throw createError({ statusCode: 400, message: error.message })
  return data
})