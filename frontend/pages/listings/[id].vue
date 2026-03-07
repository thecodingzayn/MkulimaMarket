<script setup>
const supabase = useSupabaseClient()
const route = useRoute()
const user = useSupabaseUser()
const router = useRouter()

const { data: product } = await useAsyncData('product', async () => {
  const { data: productData, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', route.params.id)
    .single()

  if (error || !productData) return null

  // Use different variable name to avoid conflict with useSupabaseUser()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // Block access only if reviewing AND not the owner
  if (productData.status === 'reviewing' && productData.user_id !== currentUser?.id) {
    return null
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('name, phone, location')
    .eq('id', productData.user_id)
    .single()

  return { ...productData, profiles: profileData }
})

// Only show active similar listings
const { data: similarListings } = await useAsyncData('similar', async () => {
  if (!product.value) return []

  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('category', product.value.category)
    .eq('location', product.value.location)
    .eq('status', 'active')
    .neq('id', route.params.id)
    .limit(4)

  return data ?? []
}, {
  watch: [product]
})

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const deleteListing = async (id) => {
  if (!confirm('Are you sure you want to delete this listing?')) return
  await supabase.from('products').delete().eq('id', id)
  router.push('/')
}
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-5xl mx-auto px-4">

      <!-- Back button -->
      <button
        @click="$router.back()"
        class="flex items-center gap-2 text-gray-500 hover:text-green-600 mb-6 transition"
      >
        ← Back to listings
      </button>

      <div v-if="product" class="flex flex-col md:flex-row gap-6">

        <!-- Left - Image & Details -->
        <div class="flex-1 min-w-0 space-y-4">

          <!-- Under Review Banner - only visible to owner -->
          <div
            v-if="product.status !== 'active' && user?.id === product.user_id"
            class="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex items-center gap-3"
          >
            <span class="text-2xl">🔄</span>
            <div>
              <p class="font-semibold text-orange-700">Your listing is under review</p>
              <p class="text-sm text-orange-500">It will be visible to others once approved</p>
            </div>
          </div>

          <!-- Image -->
          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
            <img
              v-if="product.image_url"
              :src="product.image_url"
              class="w-full h-80 object-cover"
            />
            <div
              v-else
              class="w-full h-80 flex items-center justify-center text-8xl bg-gray-50"
            >
              🌾
            </div>
          </div>

          <!-- Details -->
          <div class="bg-white rounded-2xl shadow-sm p-6">
            <div class="flex justify-between items-start flex-wrap gap-2">
              <h1 class="text-2xl font-bold text-gray-800">{{ product.title }}</h1>
              <p class="text-2xl font-bold text-green-600">KSh {{ product.price }}</p>
            </div>

            <!-- Tags -->
            <!-- Tags -->
<div class="flex flex-wrap gap-2 mt-3">
  <span class="bg-green-50 text-green-700 text-sm px-3 py-1 rounded-full">
    {{ product.category }}
  </span>
  <span class="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
    📍 {{ product.location }}
  </span>
  <span class="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
    🕒 {{ formatDate(product.created_at) }}
  </span>

  <!-- Status badge - only visible to owner -->
  <span
    v-if="user?.id === product.user_id"
    class="text-xs px-3 py-1 rounded-full font-semibold"
    :class="product.status === 'active'
      ? 'bg-green-100 text-green-700'
      : 'bg-orange-100 text-orange-600'"
  >
    {{ product.status === 'active' ? '✅ Active' : '🔄 Reviewing' }}
  </span>
</div>

            <div class="border-t my-4"></div>

            <h3 class="font-semibold text-gray-700 mb-2">Description</h3>
            <p class="text-gray-600 leading-relaxed">{{ product.description }}</p>
          </div>

        </div>

        <!-- Right - Poster Info & Contact -->
        <div class="w-full md:w-80 shrink-0 space-y-4">

          <div class="bg-white rounded-2xl shadow-sm p-6">
            <h3 class="font-bold text-gray-700 mb-4 border-b pb-3">Posted by</h3>

            <div class="flex items-center gap-3 mb-5">
              <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
                👤
              </div>
              <div>
                <p class="font-semibold text-gray-800">{{ product.profiles?.name }}</p>
                <p class="text-sm text-gray-400">📍 {{ product.profiles?.location }}</p>
              </div>
            </div>

            <!-- NOT LOGGED IN -->
            <template v-if="!user">
              <p class="text-center text-sm text-gray-400 mb-4">
                Sign in to contact this seller
              </p>
              <NuxtLink
                to="/auth/login"
                class="flex items-center justify-center w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition"
              >
                Sign In to Contact
              </NuxtLink>
            </template>

            <!-- YOUR OWN LISTING -->
            <template v-else-if="user.id === product.user_id">
              <div class="bg-green-50 text-green-700 text-sm text-center py-2 rounded-lg mb-4">
                ✅ This is your listing
              </div>
              <NuxtLink
                :to="`/listings/edit/${product.id}`"
                class="flex items-center justify-center gap-2 w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold transition mb-3"
              >
                ✏️ Edit Listing
              </NuxtLink>
              <button
                @click="deleteListing(product.id)"
                class="flex items-center justify-center gap-2 w-full bg-red-50 hover:bg-red-100 text-red-500 py-3 rounded-xl font-semibold transition"
              >
                🗑️ Delete Listing
              </button>
            </template>

            <!-- SOMEONE ELSE'S LISTING -->
            <template v-else>
              
              <a
                :href="`tel:${product.profiles?.phone}`"
                class="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition mb-3"
              >
                📞 Call {{ product.profiles?.name?.split(' ')[0] }}
              </a>
              
              <a
                :href="`https://wa.me/254${product.profiles?.phone?.slice(-9)}`"
                target="_blank"
                class="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold transition"
              >
                💬 WhatsApp
              </a>
            </template>

          </div>

          <!-- Safety Tips -->
          <div class="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
            <h4 class="font-semibold text-yellow-800 mb-3">🔒 Safety Tips</h4>
            <ul class="text-sm text-yellow-700 space-y-2">
              <li>• Meet in a safe public place</li>
              <li>• Inspect produce before paying</li>
              <li>• Never send money in advance</li>
              <li>• Deal with people you can verify</li>
            </ul>
          </div>

        </div>

      </div>

      <!-- Not found / Under review for others -->
      <div v-else class="text-center py-20">
        <div class="text-6xl mb-4">🌾</div>
        <p class="text-gray-500 text-lg">Listing not found</p>
        <NuxtLink to="/" class="mt-4 inline-block text-green-600 hover:underline">
          Back to homepage
        </NuxtLink>
      </div>

      <!-- Similar Listings - only active -->
      <div v-if="similarListings?.length > 0" class="mt-8">
        <h2 class="text-xl font-bold text-gray-800 mb-4">
          Similar {{ product?.category }} listings in {{ product?.location }}
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ProductCard
            v-for="item in similarListings"
            :key="item.id"
            :product="item"
          />
        </div>
      </div>

    </div>
  </div>
</template>