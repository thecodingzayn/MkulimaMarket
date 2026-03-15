<script setup>
definePageMeta({ middleware: 'no-admin' })
const supabase = useSupabaseClient()

const { data: products } = await useAsyncData('products', async () => {
  const { data: { user } } = await supabase.auth.getUser()

  const { data: activeListings } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('is_boosted', { ascending: false })
    .order('created_at', { ascending: false })

  if (user) {
    const { data: myReviewing } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'reviewing')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return [...(myReviewing ?? []), ...(activeListings ?? [])]
  }

  return activeListings ?? []
})

const search = ref('')
const selectedLocation = ref('')
const selectedCategory = ref('')
const minPrice = ref('')
const maxPrice = ref('')
const showFilters = ref(false)
const quantitySearch = ref('')

const categories = [
  { name: '🥬 Vegetables', icon: '🥬', label: 'Vegetables' },
  { name: '🍎 Fruits', icon: '🍎', label: 'Fruits' },
  { name: '🌽 Grains & Cereals', icon: '🌽', label: 'Grains & Cereals' },
  { name: '🥛 Dairy Products', icon: '🥛', label: 'Dairy Products' },
  { name: '🐔 Poultry', icon: '🐔', label: 'Poultry' },
  { name: '🐄 Livestock', icon: '🐄', label: 'Livestock' },
  { name: '🌿 Herbs & Spices', icon: '🌿', label: 'Herbs & Spices' },
  { name: '🍯 Honey & Organic', icon: '🍯', label: 'Honey & Organic' },
  { name: '🐟 Fish & Seafood', icon: '🐟', label: 'Fish & Seafood' },
  { name: '🌱 Seedlings & Inputs', icon: '🌱', label: 'Seedlings & Inputs' },
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
    if (p.category) {
      counts[p.category] = (counts[p.category] || 0) + 1
    }
  })
  return counts
})

const filtered = computed(() => {
  return products.value?.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.value.toLowerCase())
    const matchLocation = selectedLocation.value ? p.location === selectedLocation.value : true
    const matchCategory = selectedCategory.value ? p.category === selectedCategory.value : true
    const matchMinPrice = minPrice.value && parseFloat(minPrice.value) >= 0 ? p.price >= parseFloat(minPrice.value) : true
    const matchMaxPrice = maxPrice.value && parseFloat(maxPrice.value) >= 0 ? p.price <= parseFloat(maxPrice.value) : true
    const matchQuantity = quantitySearch.value
      ? p.quantity?.toLowerCase().includes(quantitySearch.value.toLowerCase())
      : true
    return matchSearch && matchLocation && matchCategory && matchMinPrice && matchMaxPrice && matchQuantity
  })
})

const selectCategory = (name) => {
  selectedCategory.value = selectedCategory.value === name ? '' : name
}
</script>

<template>
  <div class="bg-gray-100 min-h-screen">

    <!-- Hero -->
    <section class="bg-green-600 text-white py-16 rounded-b-3xl">
      <div class="max-w-5xl mx-auto text-center">
        <h2 class="text-3xl font-bold mb-6">What are you looking for?</h2>

        <!-- Main search row -->
        <div class="flex justify-center gap-3 mb-3">
          <select
            v-model="selectedLocation"
            class="px-4 py-3 rounded-lg text-gray-700">
            <option value="">All Kenya</option>
            <option v-for="county in counties" :key="county" :value="county">
              {{ county }}
            </option>
          </select>

          <div class="flex">
            <input
              v-model="search"
              type="text"
              placeholder="I am looking for..."
              class="w-96 px-4 py-3 rounded-l-lg text-gray-700 outline-none"
            />
            <button class="bg-white text-green-700 px-5 py-3 rounded-r-lg hover:bg-gray-100 transition border-l border-gray-200">
              🔍
            </button>
          </div>

          <!-- Filter toggle button -->
          <button
            @click="showFilters = !showFilters"
            class="relative flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition"
            :class="showFilters || activeFilterCount > 0
              ? 'bg-white text-green-700'
              : 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'">
            ⚙️ Filters
            <span
              v-if="activeFilterCount > 0"
              class="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {{ activeFilterCount }}
            </span>
          </button>
        </div>

        <!-- Expanded filter row -->
        <div v-if="showFilters" class="flex justify-center gap-3 mt-3 flex-wrap">

          <!-- Min price -->
          <div class="relative">
            <span class="absolute left-3 top-3 text-gray-400 text-sm">KSh</span>
            <input
              v-model="minPrice"
              type="number"
              min="0"
              placeholder="Min price"
              class="pl-12 pr-4 py-3 rounded-lg text-gray-700 outline-none w-36"
            />
          </div>

          <!-- Max price -->
          <div class="relative">
            <span class="absolute left-3 top-3 text-gray-400 text-sm">KSh</span>
            <input
              v-model="maxPrice"
              type="number"
              min="0"
              placeholder="Max price"
              class="pl-12 pr-4 py-3 rounded-lg text-gray-700 outline-none w-36"
            />
          </div>

          <!-- Quantity -->
          <div class="relative">
            <span class="absolute left-3 top-3 text-lg">📦</span>
            <input
              v-model="quantitySearch"
              type="text"
              placeholder="Quantity e.g. 50kg"
              class="pl-10 pr-4 py-3 rounded-lg text-gray-700 outline-none w-44"
            />
          </div>

          <!-- Clear filters -->
          <button
            v-if="activeFilterCount > 0"
            @click="clearFilters"
            class="px-4 py-3 rounded-lg bg-red-100 text-red-600 font-semibold hover:bg-red-200 transition text-sm">
            ✕ Clear filters
          </button>

        </div>

        <!-- Active filter tags -->
        <div v-if="activeFilterCount > 0" class="flex justify-center gap-2 mt-3 flex-wrap">
          <span v-if="selectedLocation"
            class="bg-white bg-opacity-20 text-white text-sm px-3 py-1 rounded-full flex items-center gap-1">
            📍 {{ selectedLocation }}
            <button @click="selectedLocation = ''" class="ml-1 hover:text-red-300">✕</button>
          </span>
          <span v-if="minPrice"
            class="bg-white bg-opacity-20 text-white text-sm px-3 py-1 rounded-full flex items-center gap-1">
            Min: KSh {{ minPrice }}
            <button @click="minPrice = ''" class="ml-1 hover:text-red-300">✕</button>
          </span>
          <span v-if="maxPrice"
            class="bg-white bg-opacity-20 text-white text-sm px-3 py-1 rounded-full flex items-center gap-1">
            Max: KSh {{ maxPrice }}
            <button @click="maxPrice = ''" class="ml-1 hover:text-red-300">✕</button>
          </span>
          <span v-if="quantitySearch"
            class="bg-white bg-opacity-20 text-white text-sm px-3 py-1 rounded-full flex items-center gap-1">
            📦 {{ quantitySearch }}
            <button @click="quantitySearch = ''" class="ml-1 hover:text-red-300">✕</button>
          </span>
        </div>

      </div>
    </section>

    <!-- Main -->
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex flex-col md:flex-row gap-6">

        <!-- Categories Sidebar -->
        <div class="w-full md:w-64 shrink-0">
          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div class="bg-green-600 text-white px-5 py-4">
              <h3 class="font-bold text-lg">Categories</h3>
            </div>
            <div class="divide-y divide-gray-100">
              <button
                @click="selectCategory('')"
                class="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition"
                :class="selectedCategory === '' ? 'bg-green-50 text-green-600 font-semibold' : 'text-gray-700'">
                <div class="flex items-center gap-3">
                  <span>🛒</span>
                  <span>All Categories</span>
                </div>
                <span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {{ products?.length ?? 0 }}
                </span>
              </button>
              <button
                v-for="cat in categories"
                :key="cat.name"
                @click="selectCategory(cat.name)"
                class="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition"
                :class="selectedCategory === cat.name ? 'bg-green-50 text-green-600 font-semibold' : 'text-gray-700'">
                <div class="flex items-center gap-3">
                  <span>{{ cat.icon }}</span>
                  <span class="text-sm">{{ cat.label }}</span>
                </div>
                <span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {{ categoryCount[cat.name] ?? 0 }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Listings -->
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-800">
              {{ selectedCategory || 'Latest Listings' }}
            </h2>
            <span class="text-sm text-gray-400">
              {{ filtered?.length ?? 0 }} listings
            </span>
          </div>

          <div v-if="filtered?.length === 0" class="bg-white rounded-2xl p-20 text-center shadow-sm">
            <div class="text-5xl mb-4">🌾</div>
            <p class="text-gray-500">No listings found</p>
            <button
              v-if="activeFilterCount > 0 || search || selectedCategory"
              @click="clearFilters(); selectCategory('')"
              class="mt-4 text-green-600 hover:underline text-sm">
              Clear all filters
            </button>
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <ProductCard
              v-for="product in filtered"
              :key="product.id"
              :product="product"
            />
          </div>
        </div>
      </div>
    </div>

  </div>
</template>