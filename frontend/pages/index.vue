<script setup>
import { Icon } from '@iconify/vue'

definePageMeta({ middleware: 'no-admin' })
const supabase = useSupabaseClient()

const PAGE_SIZE = 20

const products = ref([])
const loading = ref(true)
const loadingMore = ref(false)
const hasMore = ref(true)
const page = ref(0)
const currentUser = ref(null)

const sentinel = ref(null)
let observer = null

const fetchPage = async (reset = false) => {
  if (reset) {
    page.value = 0
    hasMore.value = true
    products.value = []
    loading.value = true
  } else {
    if (!hasMore.value || loadingMore.value) return
    loadingMore.value = true
  }

  const from = page.value * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: { user } } = await supabase.auth.getUser()
  currentUser.value = user

  const { data: activeListings } = await supabase
    .from('products')
    .select('*, listing_images(id, url, position)')
    .eq('status', 'active')
    .order('is_boosted', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  let myReviewing = []
  if (page.value === 0 && user) {
    const { data } = await supabase
      .from('products')
      .select('*, listing_images(id, url, position)')
      .eq('status', 'reviewing')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    myReviewing = data ?? []
  }

  const fetched = activeListings ?? []
  if (fetched.length < PAGE_SIZE) hasMore.value = false

  if (reset || page.value === 0) {
    products.value = [...myReviewing, ...fetched]
  } else {
    const existingIds = new Set(products.value.map(p => p.id))
    products.value = [...products.value, ...fetched.filter(p => !existingIds.has(p.id))]
  }

  page.value++
  loading.value = false
  loadingMore.value = false
}

onMounted(async () => {
  await fetchPage(true)

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore.value && !loadingMore.value && !loading.value) {
        fetchPage()
      }
    },
    { rootMargin: '200px' }
  )

  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

watch(sentinel, (el) => {
  if (observer && el) observer.observe(el)
})

const search = ref('')
const selectedLocation = ref('')
const selectedCategory = ref('')
const minPrice = ref('')
const maxPrice = ref('')
const showFilters = ref(false)
const showCategories = ref(false)
const quantitySearch = ref('')
const sortBy = ref('newest')

// Jiji-style category hover state
const hoveredCategory = ref(null)

let filterTimeout = null
const onFilterChange = () => {
  if (filterTimeout) clearTimeout(filterTimeout)
  filterTimeout = setTimeout(() => fetchPage(true), 300)
}

watch([search, selectedLocation, selectedCategory, minPrice, maxPrice, quantitySearch, sortBy], onFilterChange)

const categories = [
  {
    name: '🥬 Vegetables', label: 'Vegetables',
    img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=80&h=80&fit=crop&auto=format',
    sub: ['Tomatoes', 'Onions', 'Cabbages', 'Kale & Sukuma Wiki', 'Carrots', 'Spinach', 'Capsicum', 'Eggplant', 'Peas', 'Green Beans']
  },
  {
    name: '🍎 Fruits', label: 'Fruits',
    img: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=80&h=80&fit=crop&auto=format',
    sub: ['Mangoes', 'Avocados', 'Bananas', 'Passion Fruits', 'Watermelons', 'Pineapples', 'Oranges', 'Pawpaw', 'Strawberries', 'Guavas']
  },
  {
    name: '🌽 Grains & Cereals', label: 'Grains & Cereals',
    img: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=80&h=80&fit=crop&auto=format',
    sub: ['Maize', 'Wheat', 'Rice', 'Sorghum', 'Millet', 'Barley', 'Oats', 'Beans', 'Lentils', 'Chickpeas']
  },
  {
    name: '🥛 Dairy Products', label: 'Dairy Products',
    img: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=80&h=80&fit=crop&auto=format',
    sub: ['Fresh Milk', 'Yogurt', 'Cheese', 'Butter', 'Ghee', 'Cream', 'Fermented Milk', 'Powdered Milk', 'Ice Cream', 'Skim Milk']
  },
  {
    name: '🐔 Poultry', label: 'Poultry',
    img: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=80&h=80&fit=crop&auto=format',
    sub: ['Broilers', 'Layers', 'Kienyeji Chicken', 'Ducks', 'Turkeys', 'Geese', 'Quails', 'Guinea Fowl', 'Eggs', 'Chicks & Pullets']
  },
  {
    name: '🐄 Livestock', label: 'Livestock',
    img: 'https://images.unsplash.com/photo-1545468800-85cc9bc6ecf7?w=80&h=80&fit=crop&auto=format',
    sub: ['Dairy Cattle', 'Beef Cattle', 'Goats', 'Sheep', 'Pigs', 'Camels', 'Donkeys', 'Rabbits', 'Calves', 'Heifers']
  },
  {
    name: '🌿 Herbs & Spices', label: 'Herbs & Spices',
    img: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=80&h=80&fit=crop&auto=format',
    sub: ['Rosemary', 'Thyme', 'Basil', 'Mint', 'Coriander', 'Turmeric', 'Ginger', 'Garlic', 'Chillies', 'Black Pepper']
  },
  {
    name: '🍯 Honey & Organic', label: 'Honey & Organic',
    img: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=80&h=80&fit=crop&auto=format',
    sub: ['Raw Honey', 'Organic Honey', 'Beeswax', 'Propolis', 'Royal Jelly', 'Organic Vegetables', 'Organic Fruits', 'Natural Oils', 'Herbal Teas', 'Organic Grains']
  },
  {
    name: '🐟 Fish & Seafood', label: 'Fish & Seafood',
    img: 'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=80&h=80&fit=crop&auto=format',
    sub: ['Tilapia', 'Catfish', 'Omena', 'Nile Perch', 'Dagaa', 'Dried Fish', 'Fresh Fish', 'Smoked Fish', 'Prawns', 'Crabs']
  },
  {
    name: '🌱 Seedlings & Inputs', label: 'Seedlings & Inputs',
    img: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=80&h=80&fit=crop&auto=format',
    sub: ['Vegetable Seeds', 'Fruit Seedlings', 'Fertilizers', 'Pesticides', 'Herbicides', 'Irrigation Equipment', 'Farm Tools', 'Animal Feeds', 'Greenhouse Materials', 'Soil Boosters']
  },
  {
    name: '🌾 Cash Crops', label: 'Cash Crops',
    img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=80&h=80&fit=crop&auto=format',
    sub: ['Tea', 'Coffee', 'Sugarcane', 'Cotton', 'Tobacco', 'Pyrethrum', 'Sunflower', 'Macadamia', 'Cashew Nuts', 'Sisal']
  },
]

const counties = [
  'Nairobi', 'Nakuru', 'Eldoret', 'Kisumu', 'Mombasa',
  'Nyeri', 'Machakos', 'Kiambu', 'Meru', 'Kakamega'
]

const activeFilterCount = computed(() => {
  let count = 0
  if (selectedLocation.value) count++
  if (minPrice.value) count++
  if (maxPrice.value) count++
  if (quantitySearch.value) count++
  return count
})

const clearFilters = () => {
  selectedLocation.value = ''
  minPrice.value = ''
  maxPrice.value = ''
  search.value = ''
  quantitySearch.value = ''
}

const categoryCount = computed(() => {
  const counts = {}
  products.value?.forEach(p => {
    if (p.category) counts[p.category] = (counts[p.category] || 0) + 1
  })
  return counts
})

const filtered = computed(() => {
  let list = products.value?.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.value.toLowerCase())
    const matchLocation = selectedLocation.value ? p.location === selectedLocation.value : true
    const matchCategory = selectedCategory.value ? p.category === selectedCategory.value : true
    const matchMinPrice = minPrice.value && parseFloat(minPrice.value) >= 0 ? p.price >= parseFloat(minPrice.value) : true
    const matchMaxPrice = maxPrice.value && parseFloat(maxPrice.value) >= 0 ? p.price <= parseFloat(maxPrice.value) : true
    const matchQuantity = quantitySearch.value ? p.quantity?.toLowerCase().includes(quantitySearch.value.toLowerCase()) : true
    return matchSearch && matchLocation && matchCategory && matchMinPrice && matchMaxPrice && matchQuantity
  }) ?? []

  if (sortBy.value === 'price_asc') list = [...list].sort((a, b) => a.price - b.price)
  else if (sortBy.value === 'price_desc') list = [...list].sort((a, b) => b.price - a.price)
  else if (sortBy.value === 'most_viewed') list = [...list].sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0))
  else list = [...list].sort((a, b) => {
    if (a.is_boosted && !b.is_boosted) return -1
    if (!a.is_boosted && b.is_boosted) return 1
    return new Date(b.created_at) - new Date(a.created_at)
  })

  return list
})

const selectCategory = (name) => {
  selectedCategory.value = selectedCategory.value === name ? '' : name
  hoveredCategory.value = null
  showCategories.value = false
}

// Sub-category icons mapping
const subIcon = (sub) => {
  const icons = {
    'Tomatoes': 'mdi:fruit-cherries', 'Onions': 'mdi:circle-slice-8',
    'Maize': 'mdi:corn', 'Wheat': 'mdi:barley', 'Rice': 'mdi:rice',
    'Fresh Milk': 'mdi:cup', 'Eggs': 'mdi:egg', 'Honey': 'mdi:beehive-outline',
    'Tilapia': 'mdi:fish', 'Tea': 'mdi:tea', 'Coffee': 'mdi:coffee',
  }
  return icons[sub] ?? 'mdi:sprout'
}
</script>

<template>
  <div class="bg-gray-100 min-h-screen">

    <!-- Hero -->
    <section class="bg-green-600 text-white py-8 md:py-16 rounded-b-3xl">
      <div class="max-w-5xl mx-auto text-center px-4">
        <h2 class="text-xl md:text-3xl font-bold mb-4 md:mb-6">What are you looking for?</h2>

        <div class="flex flex-col sm:flex-row justify-center gap-2 md:gap-3 mb-3">
          <select v-model="selectedLocation"
            class="px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-gray-700 text-sm md:text-base w-full sm:w-auto">
            <option value="">All Kenya</option>
            <option v-for="county in counties" :key="county" :value="county">{{ county }}</option>
          </select>

          <div class="flex flex-1">
            <input v-model="search" type="text" placeholder="I am looking for..."
              class="flex-1 min-w-0 px-3 py-2.5 md:px-4 md:py-3 rounded-l-lg text-gray-700 outline-none text-sm md:text-base" />
            <button class="bg-white text-green-700 px-4 py-2.5 md:px-5 md:py-3 rounded-r-lg hover:bg-gray-100 transition border-l border-gray-200">
              <Icon icon="mdi:magnify" class="w-5 h-5" />
            </button>
          </div>

          <button @click="showFilters = !showFilters"
            class="relative flex items-center justify-center gap-2 px-4 py-2.5 md:py-3 rounded-lg font-semibold transition text-sm md:text-base w-full sm:w-auto"
            :class="showFilters || activeFilterCount > 0 ? 'bg-white text-green-700' : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'">
            <Icon icon="mdi:tune" class="w-5 h-5" />
            Filters
            <span v-if="activeFilterCount > 0"
              class="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {{ activeFilterCount }}
            </span>
          </button>
        </div>

        <div v-if="showFilters" class="flex flex-wrap justify-center gap-2 md:gap-3 mt-3">
          <div class="relative">
            <span class="absolute left-3 top-3 text-gray-400 text-sm">KSh</span>
            <input v-model="minPrice" type="number" min="0" placeholder="Min price"
              class="pl-12 pr-4 py-2.5 md:py-3 rounded-lg text-gray-700 outline-none w-32 md:w-36 text-sm" />
          </div>
          <div class="relative">
            <span class="absolute left-3 top-3 text-gray-400 text-sm">KSh</span>
            <input v-model="maxPrice" type="number" min="0" placeholder="Max price"
              class="pl-12 pr-4 py-2.5 md:py-3 rounded-lg text-gray-700 outline-none w-32 md:w-36 text-sm" />
          </div>
          <div class="relative">
            <Icon icon="mdi:package-variant" class="absolute left-3 top-2.5 md:top-3 w-5 h-5 text-gray-400" />
            <input v-model="quantitySearch" type="text" placeholder="Qty e.g. 50kg"
              class="pl-10 pr-4 py-2.5 md:py-3 rounded-lg text-gray-700 outline-none w-36 md:w-44 text-sm" />
          </div>
          <button v-if="activeFilterCount > 0" @click="clearFilters"
            class="flex items-center gap-1 px-4 py-2.5 md:py-3 rounded-lg bg-red-100 text-red-600 font-semibold hover:bg-red-200 transition text-sm">
            <Icon icon="mdi:close" class="w-4 h-4" />Clear filters
          </button>
        </div>

        <div v-if="activeFilterCount > 0" class="flex justify-center gap-2 mt-3 flex-wrap px-2">
          <span v-if="selectedLocation"
            class="bg-white bg-opacity-20 text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full flex items-center gap-1">
            <Icon icon="mdi:map-marker" class="w-3.5 h-3.5" />{{ selectedLocation }}
            <button @click="selectedLocation = ''" class="ml-1 hover:text-red-300"><Icon icon="mdi:close" class="w-3 h-3" /></button>
          </span>
          <span v-if="minPrice"
            class="bg-white bg-opacity-20 text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full flex items-center gap-1">
            Min: KSh {{ minPrice }}
            <button @click="minPrice = ''" class="ml-1 hover:text-red-300"><Icon icon="mdi:close" class="w-3 h-3" /></button>
          </span>
          <span v-if="maxPrice"
            class="bg-white bg-opacity-20 text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full flex items-center gap-1">
            Max: KSh {{ maxPrice }}
            <button @click="maxPrice = ''" class="ml-1 hover:text-red-300"><Icon icon="mdi:close" class="w-3 h-3" /></button>
          </span>
          <span v-if="quantitySearch"
            class="bg-white bg-opacity-20 text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full flex items-center gap-1">
            <Icon icon="mdi:package-variant" class="w-3.5 h-3.5" />{{ quantitySearch }}
            <button @click="quantitySearch = ''" class="ml-1 hover:text-red-300"><Icon icon="mdi:close" class="w-3 h-3" /></button>
          </span>
        </div>
      </div>
    </section>

    <!-- Main -->
    <div class="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">

      <!-- ===== Jiji-style Category Panel ===== -->
      <div class="bg-white rounded-2xl shadow-sm mb-6 overflow-visible relative z-20"
        @mouseleave="hoveredCategory = null">
        <div class="flex">

          <!-- Left: Main category list -->
          <div class="w-56 md:w-64 shrink-0 border-r border-gray-100">

            <!-- Header -->
            <div class="bg-green-600 text-white px-4 py-3 rounded-tl-2xl flex items-center gap-2">
              <Icon icon="mdi:view-grid" class="w-4 h-4" />
              <h3 class="font-bold text-sm">All Categories</h3>
              <!-- Mobile toggle -->
              <button class="md:hidden ml-auto" @click="showCategories = !showCategories">
                <Icon :icon="showCategories ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="w-5 h-5" />
              </button>
            </div>

            <!-- Skeleton -->
            <div v-if="loading" :class="{ 'hidden md:block': !showCategories }">
              <div v-for="n in 8" :key="n"
                class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 animate-pulse">
                <div class="w-7 h-7 rounded-lg bg-gray-200 shrink-0"></div>
                <div class="h-3 bg-gray-200 rounded-full flex-1"></div>
                <div class="w-4 h-4 bg-gray-200 rounded-full shrink-0"></div>
              </div>
            </div>

            <!-- Actual categories -->
            <div v-else :class="{ 'hidden md:block': !showCategories }">
              <!-- All categories -->
              <button @click="selectCategory('')"
                class="w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-50 hover:bg-green-50 transition group/cat"
                :class="selectedCategory === '' ? 'bg-green-50 text-green-600 font-semibold' : 'text-gray-700'">
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <Icon icon="mdi:shopping" class="w-4 h-4 text-green-600" />
                  </div>
                  <span class="text-sm">All Categories</span>
                </div>
                <span class="text-xs text-gray-400">{{ products?.length ?? 0 }}</span>
              </button>

              <!-- Each category -->
              <button v-for="cat in categories" :key="cat.name"
                @mouseenter="hoveredCategory = cat"
                @click="selectCategory(cat.name)"
                class="w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-50 hover:bg-green-50 transition group/cat"
                :class="selectedCategory === cat.name
                  ? 'bg-green-50 text-green-600 font-semibold'
                  : hoveredCategory?.name === cat.name
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-700'">
                <div class="flex items-center gap-2.5">
                  <img :src="cat.img" :alt="cat.label"
                    class="w-7 h-7 rounded-lg object-cover shrink-0" />
                  <span class="text-sm text-left">{{ cat.label }}</span>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <span class="text-xs text-gray-400">{{ categoryCount[cat.name] ?? 0 }}</span>
                  <Icon icon="mdi:chevron-right"
                    class="w-4 h-4 transition"
                    :class="hoveredCategory?.name === cat.name ? 'text-green-500' : 'text-gray-300'" />
                </div>
              </button>
            </div>
          </div>

          <!-- Right: Subcategory flyout -->
          <div class="flex-1 min-w-0 hidden md:block">

            <!-- No hover state -->
            <div v-if="!hoveredCategory"
              class="h-full min-h-[320px] flex flex-col items-center justify-center text-gray-300 select-none">
              <Icon icon="mdi:hand-pointing-left" class="w-10 h-10 mb-2" />
              <p class="text-sm">Hover a category to explore</p>
            </div>

            <!-- Subcategories -->
            <div v-else class="p-5">
              <!-- Subcategory header -->
              <div class="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                <img :src="hoveredCategory.img" :alt="hoveredCategory.label"
                  class="w-10 h-10 rounded-xl object-cover shrink-0" />
                <div class="flex-1">
                  <h3 class="font-bold text-gray-800 text-base">{{ hoveredCategory.label }}</h3>
                  <p class="text-xs text-gray-400 mt-0.5">
                    {{ categoryCount[hoveredCategory.name] ?? 0 }} listings available
                  </p>
                </div>
                <button
                  @click="selectCategory(hoveredCategory.name)"
                  class="flex items-center gap-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition shrink-0">
                  View all
                  <Icon icon="mdi:arrow-right" class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- Subcategory grid -->
              <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                <button
                  v-for="sub in hoveredCategory.sub" :key="sub"
                  @click="search = sub; selectCategory(hoveredCategory.name)"
                  class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-green-50 transition text-center group/sub border border-transparent hover:border-green-100">
                  <div class="w-10 h-10 rounded-xl bg-gray-100 group-hover/sub:bg-green-100 flex items-center justify-center transition shrink-0">
                    <Icon :icon="subIcon(sub)" class="w-5 h-5 text-gray-400 group-hover/sub:text-green-600 transition" />
                  </div>
                  <span class="text-xs text-gray-600 group-hover/sub:text-green-700 transition leading-tight font-medium">
                    {{ sub }}
                  </span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
      <!-- ===== End Category Panel ===== -->

      <!-- Listings section -->
      <div class="flex-1 min-w-0">

        <!-- Active category chip -->
        <div v-if="selectedCategory" class="flex items-center gap-2 mb-3">
          <span class="flex items-center gap-2 bg-green-100 text-green-700 text-sm font-semibold px-3 py-1.5 rounded-full">
            <Icon icon="mdi:tag" class="w-4 h-4" />
            {{ selectedCategory.replace(/^\p{Emoji}\s*/u, '') }}
            <button @click="selectCategory('')" class="ml-1 hover:text-red-500 transition">
              <Icon icon="mdi:close" class="w-3.5 h-3.5" />
            </button>
          </span>
        </div>

        <!-- Header -->
        <div class="flex justify-between items-center mb-3 md:mb-4">
          <h2 class="text-base md:text-xl font-bold text-gray-800">
            {{ selectedCategory ? selectedCategory.replace(/^\p{Emoji}\s*/u, '') : 'Latest Listings' }}
          </h2>
          <div class="flex items-center gap-2 md:gap-3">
            <span class="text-xs md:text-sm text-gray-400 hidden sm:block">
              {{ loading ? '...' : `${filtered?.length ?? 0} listings` }}
            </span>
            <select v-model="sortBy"
              class="text-xs md:text-sm border border-gray-200 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="most_viewed">Most viewed</option>
            </select>
          </div>
        </div>

        <!-- Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">

          <template v-if="loading">
            <SkeletonCard v-for="n in 8" :key="n" />
          </template>

          <template v-else-if="filtered?.length === 0">
            <div class="col-span-full bg-white rounded-2xl p-10 md:p-20 text-center shadow-sm">
              <Icon icon="mdi:sprout" class="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p class="text-gray-500 text-sm md:text-base">No listings found</p>
              <button v-if="activeFilterCount > 0 || search || selectedCategory"
                @click="clearFilters(); selectCategory('')"
                class="mt-4 text-green-600 hover:underline text-sm">
                Clear all filters
              </button>
            </div>
          </template>

          <template v-else>
            <ProductCard v-for="product in filtered" :key="product.id" :product="product" />
          </template>

        </div>

        <!-- Infinite scroll sentinel -->
        <div ref="sentinel" class="h-4 mt-4"></div>

        <!-- Loading more -->
        <div v-if="loadingMore" class="flex justify-center py-6">
          <div class="flex items-center gap-3 text-gray-400 text-sm">
            <Icon icon="mdi:loading" class="w-5 h-5 animate-spin" />
            Loading more listings...
          </div>
        </div>

        <!-- End of results -->
        <div v-if="!hasMore && !loading && filtered.length > 0"
          class="text-center py-6 text-xs text-gray-400">
          All listings loaded
        </div>

      </div>
    </div>

  </div>
</template>