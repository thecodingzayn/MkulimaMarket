<script setup>
const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

const { data: { user } } = await supabase.auth.getUser()
// --- Messaging ---
const messageDrawerOpen = ref(false)

const openMessageDrawer = () => {
  messageDrawerOpen.value = true
}

const { data: product } = await useAsyncData('product', async () => {
  const { data: productData, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', route.params.id)
    .single()

  if (error || !productData) return null

  if (productData.status === 'reviewing' && productData.user_id !== user?.id) {
    return null
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('name, phone, location')
    .eq('id', productData.user_id)
    .single()

  return { ...productData, profiles: profileData }
})

// Fetch ratings for this listing
const { data: ratings, refresh: refreshRatings } = await useAsyncData('ratings', async () => {
  const { data } = await supabase
    .from('ratings')
    .select('*, profiles(name)')
    .eq('listing_id', route.params.id)
    .order('created_at', { ascending: false })
  return data ?? []
})

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
}, { watch: [product] })

// --- Rating helpers ---
const averageRating = computed(() => {
  if (!ratings.value?.length) return null
  const sum = ratings.value.reduce((acc, r) => acc + r.score, 0)
  return (sum / ratings.value.length).toFixed(1)
})

const userExistingRating = computed(() =>
  ratings.value?.find(r => r.reviewer_id === user?.id) ?? null
)

const canRate = computed(() =>
  user && user.id !== product.value?.user_id && !userExistingRating.value
)

// Rating form state
const ratingForm = ref({ score: 0, comment: '' })
const hoverScore = ref(0)
const ratingLoading = ref(false)
const ratingError = ref('')
const ratingSuccess = ref(false)

const submitRating = async () => {
  if (!ratingForm.value.score) {
    ratingError.value = 'Please select a star rating'
    return
  }
  ratingLoading.value = true
  ratingError.value = ''
  try {
    const { error } = await supabase.from('ratings').insert({
      listing_id: parseInt(route.params.id),
      reviewer_id: user.id,
      seller_id: product.value.user_id,
      score: ratingForm.value.score,
      comment: ratingForm.value.comment || null,
    })
    if (error) throw error
    ratingSuccess.value = true
    ratingForm.value = { score: 0, comment: '' }
    await refreshRatings()
  } catch (err) {
    ratingError.value = err.message
  } finally {
    ratingLoading.value = false
  }
}

const deleteRating = async (ratingId) => {
  if (!confirm('Remove your rating?')) return
  await supabase.from('ratings').delete().eq('id', ratingId)
  ratingSuccess.value = false
  await refreshRatings()
}

const starsDisplay = (score) => {
  return Array.from({ length: 5 }, (_, i) => i + 1 <= score ? '★' : '☆').join('')
}

// --- Other helpers ---
const daysUntilExpiry = computed(() => {
  if (!product.value?.expires_at) return null
  const diff = new Date(product.value.expires_at) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const formatDate = (date) => new Date(date).toLocaleDateString('en-KE', {
  day: 'numeric', month: 'long', year: 'numeric'
})

const deleteListing = async (id) => {
  if (!confirm('Are you sure you want to delete this listing?')) return
  await supabase.from('products').delete().eq('id', id)
  router.push('/')
}

const timeAgo = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 60) return `${diff} sec ago`
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  if(diff < 172800) return `yesterday`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  return new Date(date).toLocaleDateString('en-KE')
}
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-5xl mx-auto px-4">

      <button @click="$router.back()" class="flex items-center gap-2 text-gray-500 hover:text-green-600 mb-6 transition">
        ← Back to listings
      </button>

      <div v-if="product" class="flex flex-col md:flex-row gap-6">

        <!-- Left -->
        <div class="flex-1 min-w-0 space-y-4">

          <!-- Under Review Banner -->
          <div v-if="product.status === 'reviewing' && user?.id === product.user_id"
            class="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span class="text-2xl">🔄</span>
            <div>
              <p class="font-semibold text-orange-700">Your listing is under review</p>
              <p class="text-sm text-orange-500">It will be visible to others once approved</p>
            </div>
          </div>

          <!-- Expiring soon banner - owner only -->
          <div v-if="user?.id === product.user_id && daysUntilExpiry !== null && daysUntilExpiry <= 7"
            class="border rounded-2xl px-5 py-4 flex items-center gap-3"
            :class="daysUntilExpiry <= 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'">
            <span class="text-2xl">{{ daysUntilExpiry <= 0 ? '⛔' : '⚠️' }}</span>
            <div>
              <p class="font-semibold" :class="daysUntilExpiry <= 0 ? 'text-red-700' : 'text-orange-700'">
                {{ daysUntilExpiry <= 0 ? 'This listing has expired' : `Listing expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}` }}
              </p>
              <NuxtLink :to="`/listings/edit/${product.id}`" class="text-sm underline"
                :class="daysUntilExpiry <= 0 ? 'text-red-500' : 'text-orange-500'">
                Edit listing to extend expiry →
              </NuxtLink>
            </div>
          </div>

          <!-- Image -->
          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
            <img v-if="product.image_url" :src="product.image_url" class="w-full h-80 object-cover" />
            <div v-else class="w-full h-80 flex items-center justify-center text-8xl bg-gray-50">🌾</div>
          </div>

          <!-- Details -->
          <div class="bg-white rounded-2xl shadow-sm p-6">
            <div class="flex justify-between items-start flex-wrap gap-2">
              <h1 class="text-2xl font-bold text-gray-800">{{ product.title }}</h1>
              <p class="text-2xl font-bold text-green-600">KSh {{ product.price }}</p>
            </div>

            <!-- Average rating summary -->
            <div v-if="averageRating" class="flex items-center gap-2 mt-2">
              <span class="text-yellow-400 text-lg tracking-tight">
                {{ starsDisplay(Math.round(averageRating)) }}
              </span>
              <span class="font-bold text-gray-700">{{ averageRating }}</span>
              <span class="text-sm text-gray-400">({{ ratings.length }} review{{ ratings.length === 1 ? '' : 's' }})</span>
            </div>

            <!-- Tags -->
            <div class="flex flex-wrap gap-2 mt-3">
              <span class="bg-green-50 text-green-700 text-sm px-3 py-1 rounded-full">{{ product.category }}</span>
              <span class="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">📍 {{ product.location }}</span>
              <span class="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">🕒 Created {{ timeAgo(product.created_at) }}</span>
              <span v-if="product.expires_at" class="text-xs px-3 py-1 rounded-full"
                :class="daysUntilExpiry <= 0 ? 'bg-red-100 text-red-600' : daysUntilExpiry <= 3 ? 'bg-red-100 text-red-600' : daysUntilExpiry <= 7 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'">
                {{ daysUntilExpiry <= 0 ? '⚠️ Expired' : `⏳ Expires ${formatDate(product.expires_at)}` }}
              </span>
              <span v-if="user?.id === product.user_id" class="text-xs px-3 py-1 rounded-full font-semibold"
                :class="product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'">
                {{ product.status === 'active' ? '✅ Active' : '🔄 Reviewing' }}
              </span>
            </div>

            <div class="border-t my-4"></div>

            <h3 class="font-semibold text-gray-700 mb-2">Description</h3>
            <p class="text-gray-600 leading-relaxed">{{ product.description }}</p>

            <!-- Owner actions -->
            <template v-if="user?.id === product.user_id">
              <div class="border-t mt-6 pt-4 flex gap-3">
                <NuxtLink :to="`/listings/edit/${product.id}`"
                  class="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold transition">
                  ✏️ Edit Listing
                </NuxtLink>
                <button @click="deleteListing(product.id)"
                  class="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-500 py-3 rounded-xl font-semibold transition">
                  🗑️ Delete Listing
                </button>
              </div>
            </template>
          </div>

          <!-- ===== RATINGS SECTION ===== -->
          <div class="bg-white rounded-2xl shadow-sm p-6">
            <h3 class="font-bold text-gray-800 text-lg mb-4">
              Reviews
              <span class="text-sm font-normal text-gray-400 ml-2">
                {{ ratings.length === 0 ? 'No reviews yet' : `${ratings.length} review${ratings.length === 1 ? '' : 's'}` }}
              </span>
            </h3>

            <!-- Rate this listing - non-owner, logged in, not yet rated -->
            <div v-if="canRate" class="bg-gray-50 rounded-xl p-4 mb-6">
              <p class="font-semibold text-gray-700 mb-3">Rate this seller</p>

              <!-- Star picker -->
              <div class="flex gap-1 mb-3">
                <button
                  v-for="star in 5"
                  :key="star"
                  @mouseenter="hoverScore = star"
                  @mouseleave="hoverScore = 0"
                  @click="ratingForm.score = star"
                  class="text-3xl transition-transform hover:scale-110 focus:outline-none"
                  :class="star <= (hoverScore || ratingForm.score) ? 'text-yellow-400' : 'text-gray-300'"
                >
                  ★
                </button>
              </div>

              <!-- Label for selected score -->
              <p v-if="ratingForm.score" class="text-sm text-gray-500 mb-3">
                {{ ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][ratingForm.score] }}
              </p>

              <!-- Comment -->
              <textarea
                v-model="ratingForm.comment"
                rows="2"
                placeholder="Leave a comment (optional)"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-3"
              />

              <p v-if="ratingError" class="text-red-500 text-sm mb-2">{{ ratingError }}</p>

              <button
                @click="submitRating"
                :disabled="ratingLoading || !ratingForm.score"
                class="w-full py-2 rounded-lg font-semibold text-sm transition"
                :class="ratingForm.score
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'"
              >
                {{ ratingLoading ? 'Submitting...' : 'Submit Review' }}
              </button>
            </div>

            <!-- Success state after rating -->
            <div v-if="ratingSuccess" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
              ✅ Your review was submitted!
            </div>

            <!-- Prompt to log in -->
            <div v-if="!user && ratings.length === 0" class="text-center py-4 text-sm text-gray-400">
              <NuxtLink to="/auth/login" class="text-green-600 hover:underline">Sign in</NuxtLink> to leave a review
            </div>

            <!-- Existing ratings list -->
            <div v-if="ratings.length > 0" class="space-y-4">
              <div v-for="rating in ratings" :key="rating.id"
                class="border border-gray-100 rounded-xl p-4">
                <div class="flex justify-between items-start">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm">👤</div>
                    <div>
                      <p class="font-semibold text-gray-700 text-sm">{{ rating.profiles?.name ?? 'Anonymous' }}</p>
                      <p class="text-xs text-gray-400">{{ timeAgo(rating.created_at) }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-yellow-400 tracking-tight">{{ starsDisplay(rating.score) }}</span>
                    <!-- Delete own rating -->
                    <button
                      v-if="rating.reviewer_id === user?.id"
                      @click="deleteRating(rating.id)"
                      class="text-xs text-gray-300 hover:text-red-400 transition ml-1"
                      title="Remove your review"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p v-if="rating.comment" class="text-sm text-gray-600 mt-2 ml-10">
                  "{{ rating.comment }}"
                </p>
              </div>
            </div>

            <!-- No reviews yet, logged-in non-owner who hasn't rated -->
            <div v-else-if="!canRate && user && user.id !== product.user_id" class="text-center py-6 text-sm text-gray-400">
              No reviews yet. Be the first to rate this seller!
            </div>

          </div>
          <!-- ===== END RATINGS ===== -->

        </div>

        <!-- Right Sidebar -->
        <div class="w-full md:w-80 shrink-0 space-y-4">

          <!-- OWNER VIEW -->
          <template v-if="user?.id === product.user_id">
            <div class="bg-white rounded-2xl shadow-sm p-6">
              <h3 class="font-bold text-gray-700 mb-4 border-b pb-3">Your Listing</h3>
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">👤</div>
                <div>
                  <p class="font-semibold text-gray-800">{{ product.profiles?.name }}</p>
                  <p class="text-sm text-gray-400">📍 {{ product.profiles?.location }}</p>
                </div>
              </div>
              <div class="bg-green-50 text-green-700 text-sm text-center py-3 rounded-xl font-semibold mb-4">
                ✅ This is your listing
              </div>
              <!-- Owner can also message buyers who have contacted them -->
<NuxtLink
  to="/messages"
  class="flex items-center justify-center gap-2 w-full border border-gray-200 hover:bg-gray-50 text-gray-600 py-3 rounded-xl font-semibold transition text-sm mt-3"
>
  💬 View Messages
</NuxtLink>
              <!-- Rating summary for owner -->
              <div v-if="averageRating" class="bg-yellow-50 rounded-xl p-3 text-center mb-4">
                <p class="text-2xl font-bold text-gray-800">{{ averageRating }}</p>
                <p class="text-yellow-400 text-lg">{{ starsDisplay(Math.round(averageRating)) }}</p>
                <p class="text-xs text-gray-400 mt-1">{{ ratings.length }} review{{ ratings.length === 1 ? '' : 's' }}</p>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-gray-50 rounded-xl p-3 text-center">
                  <p class="text-xl font-bold text-gray-800">0</p>
                  <p class="text-xs text-gray-400 mt-1">👁️ Views</p>
                </div>
                <div class="bg-gray-50 rounded-xl p-3 text-center">
                  <p class="text-xl font-bold text-gray-800">0</p>
                  <p class="text-xs text-gray-400 mt-1">📞 Contacts</p>
                </div>
              </div>
            </div>
          </template>

          <!-- NON-OWNER VIEW -->
          <template v-else>
            <div class="bg-white rounded-2xl shadow-sm p-6">
              <h3 class="font-bold text-gray-700 mb-4 border-b pb-3">Posted by</h3>
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">👤</div>
                <div>
                  <p class="font-semibold text-gray-800">{{ product.profiles?.name }}</p>
                  <p class="text-sm text-gray-400">📍 {{ product.profiles?.location }}</p>
                  <!-- Seller rating summary -->
                  <div v-if="averageRating" class="flex items-center gap-1 mt-1">
                    <span class="text-yellow-400 text-sm">{{ starsDisplay(Math.round(averageRating)) }}</span>
                    <span class="text-xs text-gray-500">{{ averageRating }} ({{ ratings.length }})</span>
                  </div>
                  <p v-else class="text-xs text-gray-400 mt-1">No reviews yet</p>
                </div>
              </div>

              <!-- NOT LOGGED IN -->
              <template v-if="!user">
                <p class="text-center text-sm text-gray-400 mb-4">Sign in to contact this seller</p>
                <NuxtLink to="/auth/login"
                  class="flex items-center justify-center w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition">
                  Sign In to Contact
                </NuxtLink>
              </template>

             <!-- LOGGED IN, NOT OWNER -->
<template v-else>
  <a
    :href="`tel:${product.profiles?.phone}`"
    class="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition mb-3"
  >
    📞 Call {{ product.profiles?.name?.split(' ')[0] }}
  </a>

  <!-- Message button -->
  <button
    @click="openMessageDrawer"
    class="flex items-center justify-center gap-2 w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold transition mb-3"
  >
    💬 Message Seller
  </button>

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
          </template>

        </div>
      </div>

      <!-- Not found -->
      <div v-else class="text-center py-20">
        <div class="text-6xl mb-4">🌾</div>
        <p class="text-gray-500 text-lg">Listing not found</p>
        <NuxtLink to="/" class="mt-4 inline-block text-green-600 hover:underline">Back to homepage</NuxtLink>
      </div>

      <!-- Similar Listings -->
      <div v-if="similarListings?.length > 0" class="mt-8">
        <h2 class="text-xl font-bold text-gray-800 mb-4">
          Similar {{ product?.category }} listings in {{ product?.location }}
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ProductCard v-for="item in similarListings" :key="item.id" :product="item" />
        </div>
      </div>

    </div>
    <!-- Message Drawer -->
<MessageDrawer
  v-model="messageDrawerOpen"
  :listing="product"
  :user="user"
  :other-user-id="product.user_id"
/>
  </div>
</template>