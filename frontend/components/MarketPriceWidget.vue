<script setup>
const props = defineProps({
  category: String,
  currentPrice: Number,
  query: { type: String, default: null },
  mode: {
    type: String,
    default: 'badge' // 'badge', 'suggest', 'sidebar'
  }
})

const { data, pending } = await useFetch(`/api/market/prices`, {
  query: computed(() => ({
    category: props.category,
    query: props.query || undefined
  })),
  immediate: !!props.category,
  watch: [() => props.category, () => props.query]
})

const formatPrice = (p) => p ? `KSh ${Number(p).toLocaleString('en-KE')}` : '—'

// Use live (title-matched) data if available, otherwise fall back to category-wide
const liveData = computed(() => {
  if (data.value?.live?.count > 0) return data.value.live
  if (data.value?.fallback) return data.value.fallback
  return null
})

const isFallback = computed(() =>
  data.value?.live?.count === 0 && !!data.value?.fallback
)

const pricePosition = computed(() => {
  if (!liveData.value || !props.currentPrice) return null
  const { min, max } = liveData.value
  if (!min || !max || min === max) return null
  const pos = ((props.currentPrice - min) / (max - min)) * 100
  return Math.min(100, Math.max(0, pos))
})

const priceLabel = computed(() => {
  if (!liveData.value || !props.currentPrice) return null
  const { avg } = liveData.value
  if (!avg) return null
  const diff = ((props.currentPrice - avg) / avg) * 100
  if (diff > 20) return { text: 'Above market', color: 'text-red-500' }
  if (diff < -20) return { text: 'Below market', color: 'text-green-600' }
  return { text: 'Fair price', color: 'text-blue-500' }
})

const chartPath = computed(() => {
  const hist = data.value?.history
  if (!hist?.length) return ''
  const w = 300, h = 60
  const prices = hist.map(h => Number(h.avg_price))
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * h
    return `${x},${y}`
  })
  return `M ${points.join(' L ')}`
})

const categoryLabel = computed(() =>
  props.category?.replace(/^\p{Emoji}\s*/u, '') ?? ''
)
</script>

<template>
  <div v-if="!pending && data">

    <!-- SIDEBAR MODE -->
    <template v-if="mode === 'sidebar'">
      <div v-if="liveData?.min && liveData?.max"
        class="text-sm text-gray-600 border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
        <span class="text-gray-500">Market price: </span>
        <span class="font-semibold text-blue-600">
          {{ formatPrice(liveData.min) }} ~ {{ formatPrice(liveData.max) }}
        </span>
        <span v-if="priceLabel" class="ml-2 text-xs font-medium" :class="priceLabel.color">
          · {{ priceLabel.text }}
        </span>
      </div>
    </template>

    <!-- BADGE MODE -->
    <template v-else-if="mode === 'badge'">
      <div v-if="liveData?.min && liveData?.max"
        class="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 text-sm">
        <span class="text-blue-400">📊</span>
        <span class="text-gray-500">Market price:</span>
        <span class="font-semibold text-blue-600">
          {{ formatPrice(liveData.min) }} ~ {{ formatPrice(liveData.max) }}
        </span>
        <span v-if="priceLabel" class="text-xs font-medium px-2 py-0.5 rounded-full bg-white border"
          :class="priceLabel.color">
          {{ priceLabel.text }}
        </span>
      </div>

      <div v-if="data.history?.length > 1" class="mt-3 bg-gray-50 rounded-xl p-4">
        <p class="text-xs font-semibold text-gray-500 mb-2">
          📈 {{ categoryLabel }} price trend (last {{ data.history.length }} days)
        </p>
        <svg viewBox="0 0 300 60" class="w-full h-16" preserveAspectRatio="none">
          <line x1="0" y1="30" x2="300" y2="30" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
          <path :d="chartPath" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <line v-if="pricePosition !== null"
            :x1="pricePosition * 3" y1="0"
            :x2="pricePosition * 3" y2="60"
            stroke="#f97316" stroke-width="1.5" stroke-dasharray="3"/>
        </svg>
        <div class="flex justify-between text-xs text-gray-400 mt-1">
          <span>{{ data.history[0]?.recorded_at }}</span>
          <span v-if="pricePosition !== null" class="text-orange-500">▲ Your price</span>
          <span>{{ data.history[data.history.length - 1]?.recorded_at }}</span>
        </div>
      </div>
    </template>

    <!-- SUGGEST MODE -->
    <template v-else-if="mode === 'suggest'">

      <!-- Title-matched results -->
      <div v-if="data.live?.count > 0"
        class="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm">
        <p class="font-semibold text-blue-700 mb-1">
          💡 Market insight
          <span v-if="data.searchTerm" class="font-normal text-blue-500 text-xs ml-1">
            for "{{ data.searchTerm }}"
          </span>
          <span v-else class="font-normal text-blue-500 text-xs ml-1">
            for {{ categoryLabel }}
          </span>
        </p>
        <p class="text-gray-600">
          Similar listings sell for
          <span class="font-bold text-green-600">
            {{ formatPrice(data.live.min) }} – {{ formatPrice(data.live.max) }}
          </span>
        </p>
        <p class="text-gray-400 text-xs mt-1">
          Average: {{ formatPrice(data.live.avg) }} ·
          Based on {{ data.live.count }} active listing{{ data.live.count === 1 ? '' : 's' }}
        </p>
      </div>

      <!-- Fallback to category-wide when no title match -->
      <div v-else-if="isFallback"
        class="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
        <p class="font-semibold text-gray-600 mb-1">
          💡 Category price range
          <span class="font-normal text-gray-400 text-xs ml-1">
            (no exact match for "{{ data.searchTerm }}")
          </span>
        </p>
        <p class="text-gray-600">
          {{ categoryLabel }} listings sell for
          <span class="font-bold text-green-600">
            {{ formatPrice(data.fallback.min) }} – {{ formatPrice(data.fallback.max) }}
          </span>
        </p>
        <p class="text-gray-400 text-xs mt-1">
          Average: {{ formatPrice(data.fallback.avg) }} ·
          Based on {{ data.fallback.count }} active listing{{ data.fallback.count === 1 ? '' : 's' }}
        </p>
      </div>

      <!-- No data at all -->
      <div v-else-if="data.searchTerm" class="text-xs text-gray-400 italic">
        No price data yet for "{{ data.searchTerm }}" in {{ categoryLabel }}
      </div>

    </template>

  </div>
</template>