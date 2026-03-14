<script setup>
const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

const { data: { user } } = await supabase.auth.getUser()

const messageDrawerOpen = ref(false)
const openMessageDrawer = () => { messageDrawerOpen.value = true }
const boostModal = ref(false) // ← add this

const contactRevealed = ref(false)
const formatPhone = (phone) => phone?.replace(/\s+/g, '') ?? ''

const { data: product } = await useAsyncData('product', async () => {
  const { data: productData, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', route.params.id)
    .single()

  if (error || !productData) return null

  // Non-owners cannot see reviewing or rejected listings
  if (['reviewing', 'rejected'].includes(productData.status) && productData.user_id !== user?.id) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('name, phone, location')
    .eq('id', productData.user_id)
    .single()

  return { ...productData, profiles: profileData }
})

// --- Stats ---
const { data: stats, refresh: refreshStats } = await useAsyncData('stats', async () => {
  if (!product.value) return { views: 0, contacts: 0 }
  const [{ count: views }, { count: contacts }] = await Promise.all([
    supabase.from('listing_views').select('*', { count: 'exact', head: true })
      .eq('product_id', product.value.id),
    supabase.from('listing_contacts').select('*', { count: 'exact', head: true })
      .eq('product_id', product.value.id),
  ])
  return { views: views ?? 0, contacts: contacts ?? 0 }
})

// Record view (non-owner only, once per day)
onMounted(async () => {
  if (!product.value || !user || user?.id === product.value.user_id) return
  const { error } = await supabase.from('listing_views').insert({
    product_id: product.value.id,
    viewer_id: user.id,
  })
  if (!error) await refreshStats()
})

// Record contact reveal
const revealContact = async () => {
  contactRevealed.value = true
  if (!user || user.id === product.value?.user_id) return
  try {
    await supabase.from('listing_contacts').insert({
      product_id: product.value.id,
      user_id: user.id,
    })
    await refreshStats()
  } catch (_) {}
}

const { data: ratings, refresh: refreshRatings } = await useAsyncData('ratings', async () => {
  const { data } = await supabase
    .from('ratings')
    .select('id, listing_id, reviewer_id, seller_id, score, comment, created_at')
    .eq('listing_id', route.params.id)
    .order('created_at', { ascending: false })

  if (!data?.length) return []

  const reviewerIds = [...new Set(data.map(r => r.reviewer_id).filter(Boolean))]
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', reviewerIds)

  const profileMap = Object.fromEntries(profilesData?.map(p => [p.id, p]) ?? [])
  return data.map(r => ({ ...r, profiles: profileMap[r.reviewer_id] ?? null }))
})

const hasRated = ref(ratings.value?.some(r => r.reviewer_id === user?.id) ?? false)

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

const saved = ref(false)
onMounted(async () => {
  if (!user) return
  const { data } = await supabase
    .from('saved_listings').select('id')
    .eq('user_id', user.id).eq('product_id', route.params.id)
    .maybeSingle()
  saved.value = !!data
})

const toggleSave = async () => {
  if (!user) return
  if (saved.value) {
    await supabase.from('saved_listings').delete()
      .eq('user_id', user.id).eq('product_id', route.params.id)
    saved.value = false
  } else {
    await supabase.from('saved_listings')
      .insert({ user_id: user.id, product_id: route.params.id })
    saved.value = true
  }
}

const averageRating = computed(() => {
  if (!ratings.value?.length) return null
  return (ratings.value.reduce((acc, r) => acc + r.score, 0) / ratings.value.length).toFixed(1)
})

const userExistingRating = computed(() =>
  ratings.value?.find(r => r.reviewer_id === user?.id) ?? null
)

const canRate = computed(() =>
  user &&
  user.id !== product.value?.user_id &&
  !userExistingRating.value &&
  !hasRated.value
)

const ratingForm = ref({ score: 0, comment: '' })
const hoverScore = ref(0)
const ratingLoading = ref(false)
const ratingError = ref('')
const ratingSuccess = ref(false)

const submitRating = async () => {
  if (!ratingForm.value.score) { ratingError.value = 'Please select a star rating'; return }
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
    if (error) {
      if (error.code === '23505') {
        hasRated.value = true
        ratingSuccess.value = true
        ratingForm.value = { score: 0, comment: '' }
        await refreshRatings()
        return
      }
      throw error
    }
    hasRated.value = true
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
  hasRated.value = false
  ratingSuccess.value = false
  await refreshRatings()
}

const starsDisplay = (score) =>
  Array.from({ length: 5 }, (_, i) => i + 1 <= score ? '★' : '☆').join('')

const daysUntilExpiry = computed(() => {
  if (!product.value?.expires_at) return null
  return Math.ceil((new Date(product.value.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
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
  if (diff < 172800) return `yesterday`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  return new Date(date).toLocaleDateString('en-KE')
}
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-5xl mx-auto px-4">

      <button @click="$router.back()"
        class="flex items-center gap-2 text-gray-500 hover:text-green-600 mb-6 transition">
        ← Back to listings
      </button>

      <div v-if="product" class="flex flex-col md:flex-row gap-6">

        <!-- LEFT COLUMN -->
        <div class="flex-1 min-w-0 space-y-4">

          <!-- Rejected Banner -->
          <div v-if="product.status === 'rejected' && user?.id === product.user_id"
            class="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span class="text-2xl">❌</span>
            <div>
              <p class="font-semibold text-red-700">Your listing was rejected</p>
              <p v-if="product.rejection_reason" class="text-sm text-red-500 mt-1">
                Reason: {{ product.rejection_reason }}
              </p>
              <NuxtLink :to="`/listings/edit/${product.id}`"
                class="text-sm text-red-500 underline mt-1 inline-block">
                Edit and resubmit →
              </NuxtLink>
            </div>
          </div>

          <!-- Under Review Banner -->
          <div v-if="product.status === 'reviewing' && user?.id === product.user_id"
            class="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span class="text-2xl">🔄</span>
            <div>
              <p class="font-semibold text-orange-700">Your listing is under review</p>
              <p class="text-sm text-orange-500">It will be visible to others once approved</p>
            </div>
          </div>

          <!-- Expiring soon banner -->
          <div v-if="user?.id === product.user_id && daysUntilExpiry !== null && daysUntilExpiry <= 7"
            class="border rounded-2xl px-5 py-4 flex items-center gap-3"
            :class="daysUntilExpiry <= 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'">
            <span class="text-2xl">{{ daysUntilExpiry <= 0 ? '⛔' : '⚠️' }}</span>
            <div>
              <p class="font-semibold"
                :class="daysUntilExpiry <= 0 ? 'text-red-700' : 'text-orange-700'">
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
              <div class="flex items-center gap-2 flex-1">
                <h1 class="text-2xl font-bold text-gray-800">{{ product.title }}</h1>
                <button v-if="user && user.id !== product.user_id" @click="toggleSave"
                  class="w-9 h-9 rounded-full flex items-center justify-center transition border shadow-sm text-base shrink-0"
                  :class="saved
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-400 border-gray-200 hover:bg-green-50 hover:text-green-500'">
                  🔖
                </button>
              </div>
              <p class="text-2xl font-bold text-green-600">KSh {{ product.price }}</p>
            </div>
            <div class="mt-2">
  <MarketPriceWidget
    :category="product.category"
    :current-price="Number(product.price)"
    mode="badge"
  />
</div>

            <div v-if="averageRating" class="flex items-center gap-2 mt-2">
              <span class="text-yellow-400 text-lg">{{ starsDisplay(Math.round(averageRating)) }}</span>
              <span class="font-bold text-gray-700">{{ averageRating }}</span>
              <span class="text-sm text-gray-400">({{ ratings.length }} review{{ ratings.length === 1 ? '' : 's' }})</span>
            </div>

            <div class="flex flex-wrap gap-2 mt-3">
              <span class="bg-green-50 text-green-700 text-sm px-3 py-1 rounded-full">{{ product.category }}</span>
              <span class="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">📍 {{ product.location }}</span>
              <span v-if="product.quantity"
  class="bg-blue-50 text-blue-600 text-sm px-3 py-1 rounded-full">
  📦 {{ product.quantity }}
</span>
              <span class="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">🕒 {{ timeAgo(product.created_at) }}</span>
              <span v-if="product.expires_at" class="text-xs px-3 py-1 rounded-full"
                :class="daysUntilExpiry <= 0 ? 'bg-red-100 text-red-600'
                  : daysUntilExpiry <= 3 ? 'bg-red-100 text-red-600'
                  : daysUntilExpiry <= 7 ? 'bg-orange-100 text-orange-600'
                  : 'bg-gray-100 text-gray-500'">
                {{ daysUntilExpiry <= 0 ? '⚠️ Expired' : `⏳ Expires ${formatDate(product.expires_at)}` }}
              </span>
              <span v-if="user?.id === product.user_id"
                class="text-xs px-3 py-1 rounded-full font-semibold"
                :class="product.status === 'active' ? 'bg-green-100 text-green-700'
                  : product.status === 'rejected' ? 'bg-red-100 text-red-600'
                  : 'bg-orange-100 text-orange-600'">
                {{ product.status === 'active' ? '✅ Active'
                  : product.status === 'rejected' ? '❌ Rejected'
                  : '🔄 Reviewing' }}
              </span>
            </div>

            <div class="border-t my-4"></div>
            <h3 class="font-semibold text-gray-700 mb-2">Description</h3>
            <p class="text-gray-600 leading-relaxed">{{ product.description }}</p>

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

          <!-- RATINGS -->
          <div class="bg-white rounded-2xl shadow-sm p-6">
            <h3 class="font-bold text-gray-800 text-lg mb-4">
              Reviews
              <span class="text-sm font-normal text-gray-400 ml-2">
                {{ ratings.length === 0 ? 'No reviews yet' : `${ratings.length} review${ratings.length === 1 ? '' : 's'}` }}
              </span>
            </h3>

            <div v-if="canRate" class="bg-gray-50 rounded-xl p-4 mb-6">
              <p class="font-semibold text-gray-700 mb-3">Rate this seller</p>
              <div class="flex gap-1 mb-3">
                <button v-for="star in 5" :key="star"
                  @mouseenter="hoverScore = star" @mouseleave="hoverScore = 0"
                  @click="ratingForm.score = star"
                  class="text-3xl transition-transform hover:scale-110 focus:outline-none"
                  :class="star <= (hoverScore || ratingForm.score) ? 'text-yellow-400' : 'text-gray-300'">★</button>
              </div>
              <p v-if="ratingForm.score" class="text-sm text-gray-500 mb-3">
                {{ ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][ratingForm.score] }}
              </p>
              <textarea v-model="ratingForm.comment" rows="2"
                placeholder="Leave a comment (optional)"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-3" />
              <p v-if="ratingError" class="text-red-500 text-sm mb-2">{{ ratingError }}</p>
              <button @click="submitRating" :disabled="ratingLoading || !ratingForm.score"
                class="w-full py-2 rounded-lg font-semibold text-sm transition"
                :class="ratingForm.score
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'">
                {{ ratingLoading ? 'Submitting...' : 'Submit Review' }}
              </button>
            </div>

            <div v-if="ratingSuccess"
              class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
              ✅ Your review was submitted!
            </div>

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
                    <span class="text-yellow-400">{{ starsDisplay(rating.score) }}</span>
                    <button v-if="rating.reviewer_id === user?.id" @click="deleteRating(rating.id)"
                      class="text-xs text-gray-300 hover:text-red-400 transition">✕</button>
                  </div>
                </div>
                <p v-if="rating.comment" class="text-sm text-gray-600 mt-2 ml-10">"{{ rating.comment }}"</p>
              </div>
            </div>

            <div v-else-if="!canRate && user && user.id !== product.user_id"
              class="text-center py-6 text-sm text-gray-400">
              No reviews yet. Be the first to rate this seller!
            </div>
          </div>

        </div>

        <!-- RIGHT SIDEBAR -->
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

              <NuxtLink to="/messages"
                class="flex items-center justify-center gap-2 w-full border border-gray-200 hover:bg-gray-50 text-gray-600 py-3 rounded-xl font-semibold transition text-sm mb-4">
                💬 View Messages
              </NuxtLink>
              <!-- Boost button -->
<div class="mb-4">
  <button @click="boostModal = true"
    class="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold transition text-sm">
    🔥 Boost this Listing
  </button>
  <p v-if="product.is_boosted && product.boost_ends_at"
    class="text-xs text-center text-orange-500 mt-1">
    🔥 Boosted until {{ new Date(product.boost_ends_at).toLocaleDateString('en-KE') }}
  </p>
</div>

              <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="bg-blue-50 rounded-xl p-3 text-center">
                  <p class="text-2xl font-bold text-blue-600">{{ stats?.views ?? 0 }}</p>
                  <p class="text-xs text-gray-500 mt-1">👁️ Views</p>
                </div>
                <div class="bg-green-50 rounded-xl p-3 text-center">
                  <p class="text-2xl font-bold text-green-600">{{ stats?.contacts ?? 0 }}</p>
                  <p class="text-xs text-gray-500 mt-1">📞 Contacts</p>
                </div>
              </div>

              <div v-if="averageRating" class="bg-yellow-50 rounded-xl p-3 text-center">
                <p class="text-2xl font-bold text-gray-800">{{ averageRating }}</p>
                <p class="text-yellow-400 text-lg">{{ starsDisplay(Math.round(averageRating)) }}</p>
                <p class="text-xs text-gray-400 mt-1">{{ ratings.length }} review{{ ratings.length === 1 ? '' : 's' }}</p>
              </div>
            </div>
          </template>

          <!-- NON-OWNER VIEW -->
          <template v-else>
            <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div class="flex items-center gap-3 px-4 py-3 border-b bg-gray-50">
                <div class="w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                  <img v-if="product.image_url" :src="product.image_url" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center text-xl">🌾</div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-gray-800 text-sm truncate">{{ product.title }}</p>
                  <p class="text-green-600 font-bold text-sm">
                    KSh {{ Number(product.price).toLocaleString('en-KE') }}
                  </p>
                </div>
              </div>

              <div class="p-5 space-y-3">
                <div class="flex items-center gap-3">
                  <div class="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center text-xl shrink-0">👤</div>
                  <div>
                    <p class="font-semibold text-gray-800">{{ product.profiles?.name }}</p>
                    <p class="text-xs text-gray-400">📍 {{ product.profiles?.location }}</p>
                    <div v-if="averageRating" class="flex items-center gap-1 mt-0.5">
                      <span class="text-yellow-400 text-xs">{{ starsDisplay(Math.round(averageRating)) }}</span>
                      <span class="text-xs text-gray-400">{{ averageRating }} ({{ ratings.length }})</span>
                    </div>
                    <p v-else class="text-xs text-gray-400 mt-0.5">No reviews yet</p>
                  </div>
                </div>

                <template v-if="!user">
                  <NuxtLink to="/auth/login"
                    class="flex items-center justify-center w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition text-sm">
                    Sign In to Contact
                  </NuxtLink>
                </template>

                <template v-else>
                  <button v-if="!contactRevealed" @click="revealContact"
                    class="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold transition text-sm">
                    📞 Show contact
                  </button>
                  <a v-else :href="`tel:${formatPhone(product.profiles?.phone)}`"
                    class="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold transition text-sm">
                    📞 {{ product.profiles?.phone }}
                  </a>

                  <button @click="openMessageDrawer"
                    class="flex items-center justify-center gap-2 w-full border-2 border-green-500 text-green-600 hover:bg-green-50 py-3 rounded-xl font-semibold transition text-sm">
                    💬 Send message
                  </button>

                  <a :href="`https://wa.me/254${product.profiles?.phone?.replace(/\D/g,'').slice(-9)}`"
                    target="_blank"
                    class="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white py-3 rounded-xl font-semibold transition text-sm">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                </template>
              </div>
            </div>

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

      <div v-else class="text-center py-20">
        <div class="text-6xl mb-4">🌾</div>
        <p class="text-gray-500 text-lg">Listing not found</p>
        <NuxtLink to="/" class="mt-4 inline-block text-green-600 hover:underline">Back to homepage</NuxtLink>
      </div>

      <div v-if="similarListings?.length > 0" class="mt-8">
        <h2 class="text-xl font-bold text-gray-800 mb-4">
          Similar {{ product?.category }} listings in {{ product?.location }}
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ProductCard v-for="item in similarListings" :key="item.id" :product="item" />
        </div>
      </div>

    </div>
    <BoostModal v-model="boostModal" :listing="product" :user="user"
  @boosted="refreshNuxtData('product')" />

    <MessageDrawer v-model="messageDrawerOpen" :listing="product" :user="user" :other-user-id="product?.user_id" />
  </div>
</template>