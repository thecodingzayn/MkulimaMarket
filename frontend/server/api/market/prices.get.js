import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const { category, query } = getQuery(event)
  const config = useRuntimeConfig()

  const supabase = createClient(
    process.env.SUPABASE_URL,
    config.supabaseServiceKey
  )

  // Price history
  const { data: history } = await supabase
    .from('price_history')
    .select('avg_price, min_price, max_price, listing_count, recorded_at')
    .eq('category', category)
    .order('recorded_at', { ascending: true })
    .limit(30)

  // Words that don't help identify the product type
  const noiseWords = new Set([
    // colors
    'black', 'white', 'brown', 'red', 'green', 'yellow', 'orange', 'grey', 'gray',
    'dark', 'light', 'mixed', 'spotted',
    // adjectives
    'fresh', 'dry', 'dried', 'raw', 'live', 'large', 'small', 'medium', 'big',
    'young', 'old', 'new', 'best', 'pure', 'organic', 'natural', 'local',
    'grade', 'quality', 'premium', 'select',
    // units/quantities
    'kg', 'g', 'gram', 'grams', 'litre', 'liter', 'ml', 'pcs', 'pieces',
    'piece', 'crate', 'crates', 'bag', 'bags', 'bunch', 'bunches',
    'dozen', 'pack', 'packs', 'tin', 'tins', 'sack', 'sacks',
    // common words
    'a', 'an', 'the', 'and', 'or', 'of', 'in', 'for', 'per', 'with',
    'from', 'by', 'at', 'sale', 'sell', 'selling', 'available'
  ])

  // Extract only meaningful product keywords
  const keywords = query
    ? query.trim().toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2 && !noiseWords.has(w))
    : []

  // Get all active listings in category
  const { data: catListings } = await supabase
    .from('products')
    .select('price, title')
    .eq('category', category)
    .eq('status', 'active')

  const calcStats = (prices) => ({
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
    avg: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
    count: prices.length
  })

  const allPrices = catListings?.map(p => Number(p.price)) ?? []
  const categoryStats = calcStats(allPrices)

  // If no meaningful keywords, return category-wide
  if (keywords.length === 0) {
    return {
      history: history ?? [],
      live: categoryStats,
      fallback: null,
      searchTerm: query?.trim() || null,
      isCategoryWide: true
    }
  }

  // Match listings that contain ALL meaningful keywords
  // "Black chicken" → keywords = ["chicken"] → matches "Brown chicken", "White chicken" ✅
  // "Black cow" → keywords = ["cow"] → matches "Brown cow", "Dairy cow" ✅
  // Never mixes chickens with cows ✅
  const matched = catListings?.filter(p =>
    keywords.every(kw => p.title.toLowerCase().includes(kw))
  ) ?? []

  if (matched.length > 0) {
    return {
      history: history ?? [],
      live: calcStats(matched.map(p => Number(p.price))),
      fallback: null,
      searchTerm: query?.trim() || null,
      isCategoryWide: false
    }
  }

  // Try matching ANY keyword (less strict)
  const partialMatch = catListings?.filter(p =>
    keywords.some(kw => p.title.toLowerCase().includes(kw))
  ) ?? []

  if (partialMatch.length > 0) {
    return {
      history: history ?? [],
      live: calcStats(partialMatch.map(p => Number(p.price))),
      fallback: null,
      searchTerm: query?.trim() || null,
      isCategoryWide: false
    }
  }

  // Nothing matched — return category-wide as fallback
  return {
    history: history ?? [],
    live: { min: null, max: null, avg: null, count: 0 },
    fallback: categoryStats.count > 0 ? categoryStats : null,
    searchTerm: query?.trim() || null,
    isCategoryWide: true
  }
})