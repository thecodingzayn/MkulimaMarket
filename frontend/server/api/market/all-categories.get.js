import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabase = createClient(
    process.env.SUPABASE_URL,
    config.supabaseServiceKey
  )

  const categories = [
    '🥬 Vegetables', '🍎 Fruits', '🌽 Grains & Cereals', '🥛 Dairy Products',
    '🐔 Poultry', '🐄 Livestock', '🌿 Herbs & Spices', '🍯 Honey & Organic',
    '🐟 Fish & Seafood', '🌱 Seedlings & Inputs', '🌾 Cash Crops'
  ]

  const { data: listings } = await supabase
    .from('products')
    .select('price, category, location')
    .eq('status', 'active')

  const result = categories.map(cat => {
    const catListings = listings?.filter(p => p.category === cat) ?? []
    const prices = catListings.map(p => Number(p.price))
    const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null
    const min = prices.length ? Math.min(...prices) : null
    const max = prices.length ? Math.max(...prices) : null

    const counties = {}
    catListings.forEach(p => {
      if (!p.location) return
      if (!counties[p.location]) counties[p.location] = []
      counties[p.location].push(Number(p.price))
    })
    const countyStats = Object.entries(counties).map(([location, prices]) => ({
      location,
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      count: prices.length
    })).sort((a, b) => b.count - a.count).slice(0, 6)

    return {
      category: cat,
      label: cat.replace(/^\p{Emoji}\s*/u, ''),
      min, max, avg,
      count: catListings.length,
      countyStats
    }
  })

  return result
})