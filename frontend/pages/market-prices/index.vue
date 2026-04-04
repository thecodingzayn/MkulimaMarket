<script setup>
import { Icon } from '@iconify/vue'

definePageMeta({ middleware: 'no-admin' })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const loading = ref(true)
const allCategories = ref([])
const selectedCategory = ref(null)
const selectedCategoryData = ref(null)
const trendData = ref(null)
const trendLoading = ref(false)
const searchQuery = ref('')

// Price alert modal
const showAlertModal = ref(false)
const alertForm = ref({ target_price: '', direction: 'below' })
const alertSaving = ref(false)
const alertSuccess = ref(false)
const userAlerts = ref([])

// County comparison
const showCountyBreakdown = ref(false)

const loadAllCategories = async () => {
  loading.value = true
  const { data } = await useFetch('/api/market/all-categories')
  allCategories.value = data.value ?? []
  loading.value = false
}

const loadTrend = async (cat) => {
  trendLoading.value = true
  trendData.value = null
  const { data } = await useFetch('/api/market/prices', {
    query: { category: cat.category }
  })
  trendData.value = data.value
  trendLoading.value = false
}

const selectCategory = async (cat) => {
  if (selectedCategory.value?.category === cat.category) {
    selectedCategory.value = null
    selectedCategoryData.value = null
    trendData.value = null
    return
  }
  selectedCategory.value = cat
  selectedCategoryData.value = cat
  showCountyBreakdown.value = false
  await loadTrend(cat)
}

const loadUserAlerts = async () => {
  if (!user) return
  const { data } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
  userAlerts.value = data ?? []
}

onMounted(async () => {
  await loadAllCategories()
  await loadUserAlerts()
})

const saveAlert = async () => {
  if (!user || !alertForm.value.target_price) return
  alertSaving.value = true
  try {
    await $fetch('/api/market/price-alerts', {
      method: 'POST',
      body: {
        user_id: user.id,
        category: selectedCategory.value.category,
        target_price: Number(alertForm.value.target_price),
        direction: alertForm.value.direction
      }
    })
    alertSuccess.value = true
    await loadUserAlerts()
    setTimeout(() => {
      showAlertModal.value = false
      alertSuccess.value = false
      alertForm.value = { target_price: '', direction: 'below' }
    }, 1500)
  } catch (e) {
    console.error(e)
  } finally {
    alertSaving.value = false
  }
}

const deleteAlert = async (id) => {
  await $fetch('/api/market/price-alerts', { method: 'DELETE', body: { id } })
  await loadUserAlerts()
}

const hasAlertForCategory = (catName) =>
  userAlerts.value.some(a => a.category === catName)

// SVG chart
const chartPath = computed(() => {
  const hist = trendData.value?.history
  if (!hist?.length || hist.length < 2) return ''
  const w = 600, h = 120
  const prices = hist.map(h => Number(h.avg_price))
  const min = Math.min(...prices), max = Math.max(...prices)
  const range = max - min || 1
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * (h - 10) - 5
    return `${x},${y}`
  })
  return `M ${points.join(' L ')}`
})

const chartAreaPath = computed(() => {
  const hist = trendData.value?.history
  if (!hist?.length || hist.length < 2) return ''
  const w = 600, h = 120
  const prices = hist.map(h => Number(h.avg_price))
  const min = Math.min(...prices), max = Math.max(...prices)
  const range = max - min || 1
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * (h - 10) - 5
    return `${x},${y}`
  })
  return `M 0,${h} L ${points.join(' L ')} L ${w},${h} Z`
})

const formatPrice = (p) => p != null ? `KSh ${Number(p).toLocaleString('en-KE')}` : '—'

const fairnessLabel = (price, avg) => {
  if (!avg || !price) return null
  const ratio = price / avg
  if (ratio < 0.85) return { text: 'Below market', color: 'text-blue-600 bg-blue-50', icon: 'mdi:trending-down' }
  if (ratio > 1.15) return { text: 'Above market', color: 'text-red-600 bg-red-50', icon: 'mdi:trending-up' }
  return { text: 'Fair price', color: 'text-green-600 bg-green-50', icon: 'mdi:check-circle' }
}

const filteredCategories = computed(() => {
  if (!searchQuery.value.trim()) return allCategories.value
  const q = searchQuery.value.toLowerCase()
  return allCategories.value.filter(c => c.label.toLowerCase().includes(q))
})

const mostActive = computed(() =>
  [...allCategories.value].sort((a, b) => b.count - a.count).slice(0, 5)
)

const priceChangePercent = computed(() => {
  const hist = trendData.value?.history
  if (!hist?.length || hist.length < 2) return null
  const first = Number(hist[0].avg_price)
  const last = Number(hist[hist.length - 1].avg_price)
  if (!first) return null
  return (((last - first) / first) * 100).toFixed(1)
})

const formatDate = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="bg-gray-100 min-h-screen">

    <!-- Header -->
    <div class="bg-green-600 text-white py-8 md:py-12 rounded-b-3xl">
      <div class="max-w-6xl mx-auto px-4 text-center">
        <div class="flex items-center justify-center gap-3 mb-3">
          <Icon icon="mdi:chart-line" class="w-8 h-8" />
          <h1 class="text-2xl md:text-3xl font-bold">Market Prices</h1>
        </div>
        <p class="text-green-100 text-sm md:text-base max-w-xl mx-auto">
          Live price data from active listings across Kenya. Compare prices, track trends and set alerts.
        </p>

        <!-- Search -->
        <div class="mt-6 max-w-md mx-auto">
          <div class="flex items-center bg-white rounded-xl px-4 py-3 gap-3">
            <Icon icon="mdi:magnify" class="w-5 h-5 text-gray-400 shrink-0" />
            <input v-model="searchQuery" type="text" placeholder="Search category e.g. Vegetables..."
              class="flex-1 text-gray-700 outline-none text-sm bg-transparent" />
            <button v-if="searchQuery" @click="searchQuery = ''" class="text-gray-400 hover:text-gray-600">
              <Icon icon="mdi:close" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6">

      <!-- Most Active Categories -->
      <div v-if="!loading && !searchQuery" class="bg-white rounded-2xl shadow-sm p-5">
        <h2 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Icon icon="mdi:fire" class="w-5 h-5 text-orange-500" />
          Most Active Today
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <button v-for="cat in mostActive" :key="cat.category"
            @click="selectCategory(cat)"
            class="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition text-center"
            :class="selectedCategory?.category === cat.category
              ? 'border-green-500 bg-green-50'
              : 'border-gray-100 hover:border-green-200 hover:bg-gray-50'">
            <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Icon icon="mdi:tag" class="w-5 h-5 text-green-600" />
            </div>
            <span class="text-xs font-semibold text-gray-700">{{ cat.label }}</span>
            <span class="text-xs text-gray-400">{{ cat.count }} listings</span>
          </button>
        </div>
      </div>

      <!-- All Categories Grid -->
      <div>
        <h2 class="font-bold text-gray-800 mb-4 text-lg flex items-center gap-2">
          <Icon icon="mdi:view-grid" class="w-5 h-5 text-green-600" />
          {{ searchQuery ? `Results for "${searchQuery}"` : 'All Categories' }}
        </h2>

        <!-- Skeleton -->
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="n in 9" :key="n" class="bg-white rounded-2xl shadow-sm p-5 animate-pulse">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full bg-gray-200"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-gray-200 rounded-full w-3/4"></div>
                <div class="h-3 bg-gray-200 rounded-full w-1/2"></div>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="h-12 bg-gray-200 rounded-xl"></div>
              <div class="h-12 bg-gray-200 rounded-xl"></div>
              <div class="h-12 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        </div>

        <!-- No results -->
        <div v-else-if="filteredCategories.length === 0"
          class="bg-white rounded-2xl p-16 text-center shadow-sm">
          <Icon icon="mdi:magnify-close" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p class="text-gray-500">No categories found for "{{ searchQuery }}"</p>
        </div>

        <!-- Category cards -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="cat in filteredCategories" :key="cat.category"
            class="bg-white rounded-2xl shadow-sm overflow-hidden border-2 transition cursor-pointer"
            :class="selectedCategory?.category === cat.category
              ? 'border-green-500'
              : 'border-transparent hover:border-green-200'"
            @click="selectCategory(cat)">

            <!-- Card header -->
            <div class="px-5 pt-5 pb-3">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center bg-green-50 shrink-0">
  <Icon :icon="categoryIcon(cat.category)" class="w-5 h-5 text-green-600" />
</div>
                  <div>
                    <h3 class="font-bold text-gray-800 text-sm">{{ cat.label }}</h3>
                    <p class="text-xs text-gray-400">{{ cat.count }} active listings</p>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <!-- Alert bell -->
                  <button v-if="user"
                    @click.stop="selectedCategory = cat; showAlertModal = true"
                    class="w-7 h-7 rounded-full flex items-center justify-center transition"
                    :class="hasAlertForCategory(cat.category)
                      ? 'bg-orange-100 text-orange-500'
                      : 'bg-gray-100 text-gray-400 hover:bg-orange-100 hover:text-orange-500'">
                    <Icon icon="mdi:bell-outline" class="w-4 h-4" />
                  </button>
                  <Icon icon="mdi:chevron-down" class="w-5 h-5 text-gray-400 transition"
                    :class="selectedCategory?.category === cat.category ? 'rotate-180' : ''" />
                </div>
              </div>

              <!-- Price stats -->
              <div v-if="cat.avg" class="grid grid-cols-3 gap-2">
                <div class="bg-blue-50 rounded-xl p-2 text-center">
                  <p class="text-xs text-gray-500 mb-1">Min</p>
                  <p class="text-xs font-bold text-blue-600">{{ formatPrice(cat.min) }}</p>
                </div>
                <div class="bg-green-50 rounded-xl p-2 text-center">
                  <p class="text-xs text-gray-500 mb-1">Avg</p>
                  <p class="text-xs font-bold text-green-600">{{ formatPrice(cat.avg) }}</p>
                </div>
                <div class="bg-orange-50 rounded-xl p-2 text-center">
                  <p class="text-xs text-gray-500 mb-1">Max</p>
                  <p class="text-xs font-bold text-orange-600">{{ formatPrice(cat.max) }}</p>
                </div>
              </div>
              <div v-else class="text-center py-2 text-xs text-gray-400">
                No active listings yet
              </div>
            </div>

            <!-- Expanded: trend + county breakdown -->
            <Transition name="expand">
              <div v-if="selectedCategory?.category === cat.category"
                class="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">

                <!-- Trend chart -->
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-semibold text-gray-700 flex items-center gap-1">
                      <Icon icon="mdi:chart-line" class="w-4 h-4 text-green-500" />
                      30-Day Price Trend
                    </h4>
                    <span v-if="priceChangePercent !== null"
                      class="text-xs font-bold px-2 py-0.5 rounded-full"
                      :class="Number(priceChangePercent) >= 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600'">
                      {{ Number(priceChangePercent) >= 0 ? '+' : '' }}{{ priceChangePercent }}%
                    </span>
                  </div>

                  <!-- Chart loading -->
                  <div v-if="trendLoading" class="h-32 bg-gray-100 rounded-xl animate-pulse"></div>

                  <!-- No history -->
                  <div v-else-if="!trendData?.history?.length || trendData.history.length < 2"
                    class="h-24 flex items-center justify-center text-xs text-gray-400 bg-gray-50 rounded-xl">
                    <Icon icon="mdi:chart-line" class="w-4 h-4 mr-1" />
                    Not enough data yet
                  </div>

                  <!-- SVG Chart -->
                  <div v-else class="bg-gray-50 rounded-xl p-3">
                    <svg viewBox="0 0 600 120" class="w-full h-28" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stop-color="#22c55e" stop-opacity="0.3"/>
                          <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="30" x2="600" y2="30" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
                      <line x1="0" y1="60" x2="600" y2="60" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
                      <line x1="0" y1="90" x2="600" y2="90" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
                      <path :d="chartAreaPath" fill="url(#chartGrad)" />
                      <path :d="chartPath" fill="none" stroke="#22c55e" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <div class="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{{ formatDate(trendData.history[0]?.recorded_at) }}</span>
                      <span>{{ formatDate(trendData.history[trendData.history.length - 1]?.recorded_at) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Fair price checker -->
                <div class="bg-gray-50 rounded-xl p-4">
                  <h4 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                    <Icon icon="mdi:scale-balance" class="w-4 h-4 text-blue-500" />
                    Fair Price Checker
                  </h4>
                  <FairPriceChecker :avg="cat.avg" :min="cat.min" :max="cat.max" :category="cat.category" />
                </div>

                <!-- County breakdown -->
                <div v-if="cat.countyStats?.length">
                  <button @click="showCountyBreakdown = !showCountyBreakdown"
                    class="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 w-full">
                    <Icon icon="mdi:map-marker-multiple" class="w-4 h-4 text-purple-500" />
                    Price by County
                    <Icon :icon="showCountyBreakdown ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                      class="w-4 h-4 ml-auto text-gray-400" />
                  </button>
                  <div v-if="showCountyBreakdown" class="space-y-2">
                    <div v-for="county in cat.countyStats" :key="county.location"
                      class="flex items-center gap-3">
                      <span class="text-xs text-gray-600 w-20 shrink-0">{{ county.location }}</span>
                      <div class="flex-1 bg-gray-100 rounded-full h-2">
                        <div class="bg-green-500 h-2 rounded-full transition-all"
                          :style="{ width: `${Math.min(100, (county.avg / cat.max) * 100)}%` }">
                        </div>
                      </div>
                      <span class="text-xs font-semibold text-gray-700 w-24 text-right shrink-0">
                        {{ formatPrice(county.avg) }}
                      </span>
                      <span class="text-xs text-gray-400 w-16 text-right shrink-0">
                        {{ county.count }} listings
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Set alert button -->
                <button v-if="user"
                  @click="showAlertModal = true"
                  class="w-full flex items-center justify-center gap-2 border border-orange-300 text-orange-600 hover:bg-orange-50 py-2.5 rounded-xl font-semibold text-sm transition">
                  <Icon icon="mdi:bell-plus-outline" class="w-4 h-4" />
                  {{ hasAlertForCategory(cat.category) ? 'Update Price Alert' : 'Set Price Alert' }}
                </button>
                <p v-else class="text-center text-xs text-gray-400">
                  <NuxtLink to="/auth/login" class="text-green-600 hover:underline">Sign in</NuxtLink>
                  to set price alerts
                </p>

              </div>
            </Transition>

          </div>
        </div>
      </div>

      <!-- My Price Alerts -->
      <div v-if="user && userAlerts.length > 0" class="bg-white rounded-2xl shadow-sm p-5">
        <h2 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Icon icon="mdi:bell-check" class="w-5 h-5 text-orange-500" />
          My Price Alerts
        </h2>
        <div class="space-y-2">
          <div v-for="alert in userAlerts" :key="alert.id"
            class="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
            <Icon icon="mdi:bell-outline" class="w-5 h-5 text-orange-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-800 truncate">
                {{ alert.category.replace(/^\p{Emoji}\s*/u, '') }}
              </p>
              <p class="text-xs text-gray-500">
                Alert when price goes
                <span class="font-semibold text-orange-600">{{ alert.direction }}</span>
                {{ formatPrice(alert.target_price) }}
              </p>
            </div>
            <button @click="deleteAlert(alert.id)"
              class="w-7 h-7 rounded-full hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition shrink-0">
              <Icon icon="mdi:close" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- Price Alert Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showAlertModal"
          class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center px-4"
          @click.self="showAlertModal = false">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div class="flex items-center justify-between mb-5">
              <h3 class="font-bold text-gray-800 flex items-center gap-2">
                <Icon icon="mdi:bell-plus-outline" class="w-5 h-5 text-orange-500" />
                Set Price Alert
              </h3>
              <button @click="showAlertModal = false"
                class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
                <Icon icon="mdi:close" class="w-5 h-5" />
              </button>
            </div>

            <div v-if="selectedCategory" class="bg-gray-50 rounded-xl p-3 mb-4 flex items-center gap-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center bg-green-50 shrink-0">
  <Icon :icon="categoryIcon(selectedCategory.category)" class="w-5 h-5 text-green-600" />
</div>
              <div>
                <p class="font-semibold text-gray-800 text-sm">{{ selectedCategory.label }}</p>
                <p class="text-xs text-gray-400">Current avg: {{ formatPrice(selectedCategory.avg) }}</p>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="text-sm font-semibold text-gray-700 block mb-2">Alert when price is</label>
                <div class="flex gap-2">
                  <button @click="alertForm.direction = 'below'"
                    class="flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-center gap-1"
                    :class="alertForm.direction === 'below'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'">
                    <Icon icon="mdi:trending-down" class="w-4 h-4" />
                    Below
                  </button>
                  <button @click="alertForm.direction = 'above'"
                    class="flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-center gap-1"
                    :class="alertForm.direction === 'above'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'">
                    <Icon icon="mdi:trending-up" class="w-4 h-4" />
                    Above
                  </button>
                </div>
              </div>

              <div>
                <label class="text-sm font-semibold text-gray-700 block mb-2">Target Price (KSh)</label>
                <div class="relative">
                  <span class="absolute left-3 top-3 text-gray-400 text-sm font-medium">KSh</span>
                  <input v-model="alertForm.target_price" type="number" min="0"
                    placeholder="e.g. 5000"
                    class="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>

              <div v-if="alertSuccess" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <Icon icon="mdi:check-circle" class="w-4 h-4" />
                Alert saved! We'll notify you when the price changes.
              </div>

              <button @click="saveAlert"
                :disabled="!alertForm.target_price || alertSaving"
                class="w-full py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
                :class="alertForm.target_price
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'">
                <Icon v-if="alertSaving" icon="mdi:loading" class="w-4 h-4 animate-spin" />
                <Icon v-else icon="mdi:bell-check" class="w-4 h-4" />
                {{ alertSaving ? 'Saving...' : 'Save Alert' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.expand-enter-active, .expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to, .expand-leave-from {
  opacity: 1;
  max-height: 800px;
}
</style>