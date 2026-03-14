import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const { category } = getQuery(event)
  const config = useRuntimeConfig()

  const supabase = createClient(
    process.env.SUPABASE_URL,
    config.supabaseServiceKey
  )

  // Get last 30 days of price history for this category
  const { data: history } = await supabase
    .from('price_history')
    .select('avg_price, min_price, max_price, listing_count, recorded_at')
    .eq('category', category)
    .order('recorded_at', { ascending: true })
    .limit(30)

  // Get current live stats from active listings
  const { data: live } = await supabase
    .from('products')
    .select('price')
    .eq('category', category)
    .eq('status', 'active')

  const prices = live?.map(p => Number(p.price)) ?? []
  const liveMin = prices.length ? Math.min(...prices) : null
  const liveMax = prices.length ? Math.max(...prices) : null
  const liveAvg = prices.length
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : null

  return {
    history: history ?? [],
    live: { min: liveMin, max: liveMax, avg: liveAvg, count: prices.length }
  }
})