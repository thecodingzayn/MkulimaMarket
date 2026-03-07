<script setup>
const supabase = useSupabaseClient()

const { data: products } = await useAsyncData('products', async () => {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch active listings
  const { data: activeListings } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // If logged in, also fetch their own reviewing listings
  if (user) {
    const { data: myReviewing } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'reviewing')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Merge - own reviewing listings appear first
    return [...(myReviewing ?? []), ...(activeListings ?? [])]
  }

  return activeListings ?? []
})

const search = ref('')
const selectedLocation = ref('')
const selectedCategory = ref('')

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
    return matchSearch && matchLocation && matchCategory
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
        <div class="flex justify-center gap-3">
          <select
            v-model="selectedLocation"
            class="px-4 py-3 rounded-lg text-gray-700"
          >
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
              <!-- All Categories -->
              <button
                @click="selectCategory('')"
                class="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition"
                :class="selectedCategory === '' ? 'bg-green-50 text-green-600 font-semibold' : 'text-gray-700'"
              >
                <div class="flex items-center gap-3">
                  <span>🛒</span>
                  <span>All Categories</span>
                </div>
                <span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {{ products?.length ?? 0 }}
                </span>
              </button>

              <!-- Each Category -->
              <button
  v-for="cat in categories"
  :key="cat.name"
  @click="selectCategory(cat.name)"
  class="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition"
  :class="selectedCategory === cat.name ? 'bg-green-50 text-green-600 font-semibold' : 'text-gray-700'"
>
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

          <!-- Header -->
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-800">
              {{ selectedCategory || 'Latest Listings' }}
            </h2>
            <span class="text-sm text-gray-400">
              {{ filtered?.length ?? 0 }} listings
            </span>
          </div>

          <!-- No results -->
          <div v-if="filtered?.length === 0" class="bg-white rounded-2xl p-20 text-center shadow-sm">
            <div class="text-5xl mb-4">🌾</div>
            <p class="text-gray-500">No listings found</p>
          </div>

          <!-- Grid -->
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