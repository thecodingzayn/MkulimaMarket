<script setup>
import { Icon } from '@iconify/vue'

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

const { data: { user } } = await supabase.auth.getUser()

const messageDrawerOpen = ref(false)
const openMessageDrawer = () => { messageDrawerOpen.value = true }

const contactRevealed = ref(false)
const formatPhone = (phone) => phone?.replace(/\s+/g, '') ?? ''

const showPriceHistory = ref(false)
const showUnavailableModal = ref(false)
const reportingUnavailable = ref(false)
const boostModal = ref(false)
const copied = ref(false)

// Loading states
const loading = ref(true)
const product = ref(null)
const marketData = ref(null)
const stats = ref({ views: 0, contacts: 0 })
const ratings = ref([])
const similarListings = ref([])
const saved = ref(false)
const hasRated = ref(false)

const refreshStats = async () => {
  if (!product.value) return
  const [{ count: views }, { count: contacts }] = await Promise.all([
    supabase.from('listing_views').select('*', { count: 'exact', head: true }).eq('product_id', product.value.id),
    supabase.from('listing_contacts').select('*', { count: 'exact', head: true }).eq('product_id', product.value.id),
  ])
  stats.value = { views: views ?? 0, contacts: contacts ?? 0 }
}

const refreshRatings = async () => {
  const { data } = await supabase
    .from('ratings')
    .select('id, listing_id, reviewer_id, seller_id, score, comment, created_at')
    .eq('listing_id', route.params.id)
    .order('created_at', { ascending: false })

  if (!data?.length) { ratings.value = []; return }

  const reviewerIds = [...new Set(data.map(r => r.reviewer_id).filter(Boolean))]
  const { data: profilesData } = await supabase.from('profiles').select('id, name').in('id', reviewerIds)
  const profileMap = Object.fromEntries(profilesData?.map(p => [p.id, p]) ?? [])
  ratings.value = data.map(r => ({ ...r, profiles: profileMap[r.reviewer_id] ?? null }))
  hasRated.value = ratings.value.some(r => r.reviewer_id === user?.id)
}

onMounted(async () => {
  loading.value = true

  // Load product
  const { data: productData, error } = await supabase
    .from('products')
    .select('*, listing_images(id, url, position)')
    .eq('id', route.params.id)
    .single()

  if (error || !productData) { loading.value = false; return }
  if (['reviewing', 'rejected'].includes(productData.status) && productData.user_id !== user?.id) { loading.value = false; return }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('name, phone, location, created_at')
    .eq('id', productData.user_id)
    .single()

  product.value = { ...productData, profiles: profileData }
  loading.value = false

  // Load everything else in parallel after product is shown
  await Promise.all([
    refreshStats(),
    refreshRatings(),
    // Market data
    useFetch(`/api/market/prices`, { query: { category: product.value.category } })
      .then(({ data }) => { marketData.value = data.value }),
    // Similar listings
    supabase
      .from('products')
      .select('*, listing_images(id, url, position)')
      .eq('category', product.value.category)
      .eq('location', product.value.location)
      .eq('status', 'active')
      .neq('id', route.params.id)
      .limit(4)
      .then(({ data }) => { similarListings.value = data ?? [] }),
    // Saved status
    user ? supabase.from('saved_listings').select('id')
      .eq('user_id', user.id)
      .eq('product_id', route.params.id)
      .maybeSingle()
      .then(({ data }) => { saved.value = !!data }) : Promise.resolve(),
    // Track view
    (user && user.id !== product.value.user_id)
      ? supabase.from('listing_views')
          .insert({ product_id: product.value.id, viewer_id: user.id })
          .then(() => refreshStats())
      : Promise.resolve()
  ])
})

const revealContact = async () => {
  contactRevealed.value = true
  if (!user || user.id === product.value?.user_id) return
  try {
    await supabase.from('listing_contacts').insert({ product_id: product.value.id, user_id: user.id })
    await refreshStats()
  } catch (_) {}
}

const confirmUnavailable = async () => {
  reportingUnavailable.value = true
  try {
    await $fetch('/api/flag-listing', { method: 'POST', body: { productId: product.value.id, title: product.value.title, ownerId: product.value.user_id } })
    showUnavailableModal.value = false
    router.push('/')
  } catch (e) { console.error(e) } finally { reportingUnavailable.value = false }
}

const shareOnWhatsApp = () => {
  const url = `https://mkulima-market-mocha.vercel.app/listings/${product.value.id}`
  const text = `Check out this listing on MkulimaMarket: ${product.value.title} - KSh ${Number(product.value.price).toLocaleString('en-KE')}`
  window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank')
}

const copyLink = async () => {
  const url = `https://mkulima-market-mocha.vercel.app/listings/${product.value.id}`
  await navigator.clipboard.writeText(url)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

const toggleSave = async () => {
  if (!user) return
  if (saved.value) {
    await supabase.from('saved_listings').delete().eq('user_id', user.id).eq('product_id', route.params.id)
    saved.value = false
  } else {
    await supabase.from('saved_listings').insert({ user_id: user.id, product_id: route.params.id })
    saved.value = true
  }
}

const averageRating = computed(() => {
  if (!ratings.value?.length) return null
  return (ratings.value.reduce((acc, r) => acc + r.score, 0) / ratings.value.length).toFixed(1)
})

const userExistingRating = computed(() => ratings.value?.find(r => r.reviewer_id === user?.id) ?? null)
const canRate = computed(() => user && user.id !== product.value?.user_id && !userExistingRating.value && !hasRated.value)

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
      if (error.code === '23505') { hasRated.value = true; ratingSuccess.value = true; ratingForm.value = { score: 0, comment: '' }; await refreshRatings(); return }
      throw error
    }
    hasRated.value = true
    ratingSuccess.value = true
    ratingForm.value = { score: 0, comment: '' }
    await refreshRatings()
  } catch (err) { ratingError.value = err.message } finally { ratingLoading.value = false }
}

const deleteRating = async (ratingId) => {
  if (!confirm('Remove your rating?')) return
  await supabase.from('ratings').delete().eq('id', ratingId)
  hasRated.value = false
  ratingSuccess.value = false
  await refreshRatings()
}

const starsDisplay = (score) => Array.from({ length: 5 }, (_, i) => i + 1 <= score ? '★' : '☆').join('')

const daysUntilExpiry = computed(() => {
  if (!product.value?.expires_at) return null
  return Math.ceil((new Date(product.value.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
})

const formatDate = (date) => new Date(date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })

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
  if (diff < 172800) return 'yesterday'
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  return new Date(date).toLocaleDateString('en-KE')
}

const memberSince = (date) => {
  if (!date) return null
  const months = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24 * 30))
  if (months < 1) return 'New member'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} on MkulimaMarket`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'} on MkulimaMarket`
}

const activeImage = ref(0)
const images = computed(() => {
  const imgs = product.value?.listing_images
  if (!imgs?.length) return []
  return [...imgs].sort((a, b) => a.position - b.position).map(i => i.url)
})

const reportListing = () => alert('Thank you for reporting. Our team will review this listing.')

const priceHistoryChartPath = computed(() => {
  const hist = marketData.value?.history
  if (!hist?.length) return ''
  const w = 400, h = 100
  const prices = hist.map(h => Number(h.avg_price))
  const min = Math.min(...prices), max = Math.max(...prices)
  const range = max - min || 1
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * h
    return `${x},${y}`
  })
  return `M ${points.join(' L ')}`
})

const formatPrice = (p) => p ? `KSh ${Number(p).toLocaleString('en-KE')}` : '—'
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-5xl mx-auto px-4">

      <button @click="$router.back()" class="flex items-center gap-2 text-gray-500 hover:text-green-600 mb-6 transition">
        <Icon icon="mdi:arrow-left" class="w-5 h-5" />
        Back to listings
      </button>

      <!-- SKELETON -->
      <div v-if="loading" class="flex flex-col md:flex-row gap-6 animate-pulse">

        <!-- Left skeleton -->
        <div class="flex-1 min-w-0 space-y-4">
          <!-- Image skeleton -->
          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div class="w-full h-80 bg-gray-200"></div>
          </div>
          <!-- Details skeleton -->
          <div class="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div class="h-7 bg-gray-200 rounded-full w-3/4"></div>
            <div class="flex gap-3">
              <div class="h-4 bg-gray-200 rounded-full w-24"></div>
              <div class="h-4 bg-gray-200 rounded-full w-24"></div>
              <div class="h-4 bg-gray-200 rounded-full w-24"></div>
            </div>
            <div class="h-4 bg-gray-200 rounded-full w-1/3"></div>
            <div class="border-t pt-4 space-y-2">
              <div class="h-4 bg-gray-200 rounded-full w-full"></div>
              <div class="h-4 bg-gray-200 rounded-full w-full"></div>
              <div class="h-4 bg-gray-200 rounded-full w-2/3"></div>
            </div>
          </div>
        </div>

        <!-- Right sidebar skeleton -->
        <div class="w-full md:w-80 shrink-0 space-y-4">
          <!-- Price card skeleton -->
          <div class="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <div class="h-9 bg-gray-200 rounded-full w-1/2"></div>
            <div class="h-8 bg-gray-200 rounded-lg w-32"></div>
            <div class="h-10 bg-gray-200 rounded-xl w-full"></div>
          </div>
          <!-- Seller card skeleton -->
          <div class="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-full bg-gray-200 shrink-0"></div>
              <div class="space-y-2 flex-1">
                <div class="h-4 bg-gray-200 rounded-full w-3/4"></div>
                <div class="h-3 bg-gray-200 rounded-full w-1/2"></div>
                <div class="h-3 bg-gray-200 rounded-full w-2/3"></div>
              </div>
            </div>
            <div class="h-12 bg-gray-200 rounded-xl w-full"></div>
            <div class="h-12 bg-gray-200 rounded-xl w-full"></div>
            <div class="h-12 bg-gray-200 rounded-xl w-full"></div>
          </div>
          <!-- Safety tips skeleton -->
          <div class="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <div class="h-4 bg-gray-200 rounded-full w-1/3"></div>
            <div class="h-3 bg-gray-200 rounded-full w-full"></div>
            <div class="h-3 bg-gray-200 rounded-full w-full"></div>
            <div class="h-3 bg-gray-200 rounded-full w-4/5"></div>
            <div class="h-3 bg-gray-200 rounded-full w-full"></div>
          </div>
        </div>
      </div>

      <!-- ACTUAL CONTENT -->
      <div v-else-if="product" class="flex flex-col md:flex-row gap-6">

        <!-- LEFT COLUMN -->
        <div class="flex-1 min-w-0 space-y-4">

          <!-- Rejected Banner -->
          <div v-if="product.status === 'rejected' && user?.id === product.user_id"
            class="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <Icon icon="mdi:close-circle" class="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p class="font-semibold text-red-700">Your listing was rejected</p>
              <p v-if="product.rejection_reason" class="text-sm text-red-500 mt-1">Reason: {{ product.rejection_reason }}</p>
              <NuxtLink :to="`/listings/edit/${product.id}`" class="text-sm text-red-500 underline mt-1 inline-block">Edit and resubmit →</NuxtLink>
            </div>
          </div>

          <!-- Under Review Banner -->
          <div v-if="product.status === 'reviewing' && user?.id === product.user_id"
            class="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <Icon icon="mdi:clock-outline" class="w-6 h-6 text-orange-500 shrink-0" />
            <div>
              <p class="font-semibold text-orange-700">Your listing is under review</p>
              <p class="text-sm text-orange-500">It will be visible to others once approved</p>
            </div>
          </div>

          <!-- Expiring soon banner -->
          <div v-if="user?.id === product.user_id && daysUntilExpiry !== null && daysUntilExpiry <= 7"
            class="border rounded-2xl px-5 py-4 flex items-center gap-3"
            :class="daysUntilExpiry <= 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'">
            <Icon :icon="daysUntilExpiry <= 0 ? 'mdi:alert-circle' : 'mdi:alert'" class="w-6 h-6 shrink-0"
              :class="daysUntilExpiry <= 0 ? 'text-red-500' : 'text-orange-500'" />
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

          <!-- Image Gallery -->
          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div class="relative">
              <img v-if="images.length > 0" :src="images[activeImage]" class="w-full h-80 object-cover" />
              <div v-else class="w-full h-80 flex items-center justify-center bg-gray-50">
                <Icon icon="mdi:sprout" class="w-24 h-24 text-gray-300" />
              </div>

              <div v-if="images.length > 0"
                class="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Icon icon="mdi:camera" class="w-3.5 h-3.5" />
                {{ activeImage + 1 }}/{{ images.length }}
              </div>

              <button v-if="images.length > 1" @click="activeImage = Math.max(0, activeImage - 1)"
                class="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full flex items-center justify-center shadow transition text-gray-700">
                <Icon icon="mdi:chevron-left" class="w-5 h-5" />
              </button>
              <button v-if="images.length > 1" @click="activeImage = Math.min(images.length - 1, activeImage + 1)"
                class="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full flex items-center justify-center shadow transition text-gray-700">
                <Icon icon="mdi:chevron-right" class="w-5 h-5" />
              </button>
            </div>

            <div v-if="images.length > 1" class="flex gap-2 p-3 overflow-x-auto">
              <button v-for="(img, i) in images" :key="i" @click="activeImage = i"
                class="w-20 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition"
                :class="activeImage === i ? 'border-green-500' : 'border-transparent opacity-60 hover:opacity-100'">
                <img :src="img" class="w-full h-full object-cover" />
              </button>
            </div>
          </div>

          <!-- Details -->
          <div class="bg-white rounded-2xl shadow-sm p-6">
            <div class="flex justify-between items-start flex-wrap gap-2">
              <div class="flex items-center gap-2 flex-1 flex-wrap">
                <h1 class="text-2xl font-bold text-gray-800">{{ product.title }}</h1>

                <button v-if="user && user.id !== product.user_id" @click="toggleSave"
                  class="w-9 h-9 rounded-full flex items-center justify-center transition border shadow-sm shrink-0"
                  :class="saved ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-400 border-gray-200 hover:bg-green-50 hover:text-green-500'">
                  <Icon :icon="saved ? 'mdi:bookmark' : 'mdi:bookmark-outline'" class="w-5 h-5" />
                </button>

                <div class="relative group/share">
                  <button class="w-9 h-9 rounded-full flex items-center justify-center transition border shadow-sm shrink-0 bg-white text-gray-400 border-gray-200 hover:bg-blue-50 hover:text-blue-500">
                    <Icon icon="mdi:share-variant-outline" class="w-5 h-5" />
                  </button>
                  <div class="absolute left-0 top-11 bg-white rounded-xl shadow-lg border border-gray-100 w-52 z-50 overflow-hidden opacity-0 group-hover/share:opacity-100 pointer-events-none group-hover/share:pointer-events-auto transition-opacity">
                    <button @click="shareOnWhatsApp"
                      class="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition border-b border-gray-100">
                      <svg class="w-5 h-5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Share on WhatsApp
                    </button>
                    <button @click="copyLink"
                      class="w-full flex items-center gap-3 px-4 py-3 text-sm transition"
                      :class="copied ? 'text-green-600 bg-green-50' : 'text-gray-700 hover:bg-gray-50'">
                      <Icon :icon="copied ? 'mdi:check-circle' : 'mdi:link-variant'" class="w-5 h-5 shrink-0"
                        :class="copied ? 'text-green-500' : 'text-blue-500'" />
                      {{ copied ? 'Link copied!' : 'Copy link' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap gap-3 mt-3 text-sm text-gray-500">
              <span class="flex items-center gap-1"><Icon icon="mdi:map-marker" class="w-4 h-4 text-green-500" />{{ product.location }}</span>
              <span>·</span>
              <span class="flex items-center gap-1"><Icon icon="mdi:tag" class="w-4 h-4" />{{ product.category?.replace(/^\p{Emoji}\s*/u, '') }}</span>
              <span>·</span>
              <span class="flex items-center gap-1"><Icon icon="mdi:clock-outline" class="w-4 h-4" />{{ timeAgo(product.created_at) }}</span>
              <span>·</span>
              <span class="flex items-center gap-1"><Icon icon="mdi:eye-outline" class="w-4 h-4" />{{ stats?.views ?? 0 }} views</span>
            </div>

            <div v-if="averageRating" class="flex items-center gap-2 mt-3">
              <span class="text-yellow-400 text-lg">{{ starsDisplay(Math.round(averageRating)) }}</span>
              <span class="font-bold text-gray-700">{{ averageRating }}</span>
              <span class="text-sm text-gray-400">({{ ratings.length }} review{{ ratings.length === 1 ? '' : 's' }})</span>
            </div>

            <div class="flex flex-wrap gap-2 mt-3">
              <span v-if="product.quantity" class="bg-blue-50 text-blue-600 text-sm px-3 py-1 rounded-full flex items-center gap-1">
                <Icon icon="mdi:package-variant" class="w-4 h-4" />{{ product.quantity }}
              </span>
              <span v-if="product.expires_at" class="text-xs px-3 py-1 rounded-full flex items-center gap-1"
                :class="daysUntilExpiry <= 0 ? 'bg-red-100 text-red-600' : daysUntilExpiry <= 3 ? 'bg-red-100 text-red-600' : daysUntilExpiry <= 7 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'">
                <Icon icon="mdi:calendar-clock" class="w-3.5 h-3.5" />
                {{ daysUntilExpiry <= 0 ? 'Expired' : `Expires ${formatDate(product.expires_at)}` }}
              </span>
              <span v-if="user?.id === product.user_id"
                class="text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1"
                :class="product.status === 'active' ? 'bg-green-100 text-green-700' : product.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'">
                <Icon :icon="product.status === 'active' ? 'mdi:check-circle' : product.status === 'rejected' ? 'mdi:close-circle' : 'mdi:clock-outline'" class="w-3.5 h-3.5" />
                {{ product.status === 'active' ? 'Active' : product.status === 'rejected' ? 'Rejected' : 'Reviewing' }}
              </span>
            </div>

            <div class="border-t my-4"></div>
            <h3 class="font-semibold text-gray-700 mb-2">Description</h3>
            <p class="text-gray-600 leading-relaxed">{{ product.description }}</p>

            <template v-if="user?.id === product.user_id">
              <div class="border-t mt-6 pt-4 flex gap-3">
                <NuxtLink :to="`/listings/edit/${product.id}`"
                  class="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold transition">
                  <Icon icon="mdi:pencil" class="w-4 h-4" />Edit Listing
                </NuxtLink>
                <button @click="deleteListing(product.id)"
                  class="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-500 py-3 rounded-xl font-semibold transition">
                  <Icon icon="mdi:delete-outline" class="w-4 h-4" />Delete Listing
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
                  @mouseenter="hoverScore = star" @mouseleave="hoverScore = 0" @click="ratingForm.score = star"
                  class="text-3xl transition-transform hover:scale-110 focus:outline-none"
                  :class="star <= (hoverScore || ratingForm.score) ? 'text-yellow-400' : 'text-gray-300'">★</button>
              </div>
              <p v-if="ratingForm.score" class="text-sm text-gray-500 mb-3">{{ ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][ratingForm.score] }}</p>
              <textarea v-model="ratingForm.comment" rows="2" placeholder="Leave a comment (optional)"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-3" />
              <p v-if="ratingError" class="text-red-500 text-sm mb-2">{{ ratingError }}</p>
              <button @click="submitRating" :disabled="ratingLoading || !ratingForm.score"
                class="w-full py-2 rounded-lg font-semibold text-sm transition"
                :class="ratingForm.score ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'">
                {{ ratingLoading ? 'Submitting...' : 'Submit Review' }}
              </button>
            </div>

            <div v-if="ratingSuccess" class="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
              <Icon icon="mdi:check-circle" class="w-4 h-4" />Your review was submitted!
            </div>

            <div v-if="ratings.length > 0" class="space-y-4">
              <div v-for="rating in ratings" :key="rating.id" class="border border-gray-100 rounded-xl p-4">
                <div class="flex justify-between items-start">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Icon icon="mdi:account" class="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p class="font-semibold text-gray-700 text-sm">{{ rating.profiles?.name ?? 'Anonymous' }}</p>
                      <p class="text-xs text-gray-400">{{ timeAgo(rating.created_at) }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-yellow-400">{{ starsDisplay(rating.score) }}</span>
                    <button v-if="rating.reviewer_id === user?.id" @click="deleteRating(rating.id)" class="text-gray-300 hover:text-red-400 transition">
                      <Icon icon="mdi:close" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p v-if="rating.comment" class="text-sm text-gray-600 mt-2 ml-10">"{{ rating.comment }}"</p>
              </div>
            </div>

            <div v-else-if="!canRate && user && user.id !== product.user_id" class="text-center py-6 text-sm text-gray-400">
              No reviews yet. Be the first to rate this seller!
            </div>
          </div>

        </div>

        <!-- RIGHT SIDEBAR -->
        <div class="w-full md:w-80 shrink-0 space-y-4">

          <!-- OWNER VIEW -->
          <template v-if="user?.id === product.user_id">
            <div class="bg-white rounded-2xl shadow-sm p-6">
              <p class="text-3xl font-bold text-gray-800 mb-2">KSh {{ Number(product.price).toLocaleString('en-KE') }}</p>

              <button @click="showPriceHistory = true"
                class="flex items-center gap-1 text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition mb-2">
                <Icon icon="mdi:chart-line" class="w-4 h-4" />Price History
              </button>

              <MarketPriceWidget :category="product.category" :current-price="Number(product.price)" mode="sidebar" />

              <h3 class="font-bold text-gray-700 mt-4 mb-4 border-b pb-3">Your Listing</h3>
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Icon icon="mdi:account" class="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p class="font-semibold text-gray-800">{{ product.profiles?.name }}</p>
                  <p class="text-sm text-gray-400 flex items-center gap-1"><Icon icon="mdi:map-marker" class="w-3.5 h-3.5" />{{ product.profiles?.location }}</p>
                  <p v-if="product.profiles?.created_at" class="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Icon icon="mdi:account-clock" class="w-3.5 h-3.5" />{{ memberSince(product.profiles.created_at) }}
                  </p>
                </div>
              </div>

              <div class="bg-green-50 text-green-700 text-sm text-center py-3 rounded-xl font-semibold mb-4 flex items-center justify-center gap-2">
                <Icon icon="mdi:check-circle" class="w-4 h-4" />This is your listing
              </div>

              <NuxtLink to="/messages" class="flex items-center justify-center gap-2 w-full border border-gray-200 hover:bg-gray-50 text-gray-600 py-3 rounded-xl font-semibold transition text-sm mb-4">
                <Icon icon="mdi:message-outline" class="w-4 h-4" />View Messages
              </NuxtLink>

              <button @click="boostModal = true"
                class="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold transition text-sm mb-4">
                <Icon icon="mdi:fire" class="w-4 h-4" />Boost this Listing
              </button>
              <p v-if="product.is_boosted && product.boost_ends_at" class="text-xs text-center text-orange-500 mb-3 flex items-center justify-center gap-1">
                <Icon icon="mdi:fire" class="w-3.5 h-3.5" />Boosted until {{ new Date(product.boost_ends_at).toLocaleDateString('en-KE') }}
              </p>

              <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="bg-blue-50 rounded-xl p-3 text-center">
                  <p class="text-2xl font-bold text-blue-600">{{ stats?.views ?? 0 }}</p>
                  <p class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><Icon icon="mdi:eye-outline" class="w-3.5 h-3.5" />Views</p>
                </div>
                <div class="bg-green-50 rounded-xl p-3 text-center">
                  <p class="text-2xl font-bold text-green-600">{{ stats?.contacts ?? 0 }}</p>
                  <p class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><Icon icon="mdi:phone-outline" class="w-3.5 h-3.5" />Contacts</p>
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
            <div class="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <p class="text-3xl font-bold text-gray-800">KSh {{ Number(product.price).toLocaleString('en-KE') }}</p>
              <button @click="showPriceHistory = true" class="flex items-center gap-1 text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                <Icon icon="mdi:chart-line" class="w-4 h-4" />Price History
              </button>
              <MarketPriceWidget :category="product.category" :current-price="Number(product.price)" mode="sidebar" />
              <template v-if="!user">
                <NuxtLink to="/auth/login" class="flex items-center justify-center gap-2 w-full border border-green-500 text-green-600 hover:bg-green-50 py-3 rounded-xl font-semibold transition text-sm">
                  <Icon icon="mdi:login" class="w-4 h-4" />Sign In to Contact
                </NuxtLink>
              </template>
              <template v-else>
                <button v-if="!contactRevealed" @click="revealContact" class="flex items-center justify-center gap-2 w-full border border-green-500 text-green-600 hover:bg-green-50 py-3 rounded-xl font-semibold transition text-sm">
                  <Icon icon="mdi:phone-outline" class="w-4 h-4" />Request call back
                </button>
                <a v-else :href="`tel:${formatPhone(product.profiles?.phone)}`" class="flex items-center justify-center gap-2 w-full border border-green-500 text-green-600 hover:bg-green-50 py-3 rounded-xl font-semibold transition text-sm">
                  <Icon icon="mdi:phone" class="w-4 h-4" />{{ product.profiles?.phone }}
                </a>
              </template>
            </div>

            <div class="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Icon icon="mdi:account" class="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <NuxtLink :to="`/profile/${product.user_id}`" class="font-bold text-gray-800 hover:text-green-600 transition">{{ product.profiles?.name }}</NuxtLink>
                  <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Icon icon="mdi:account-clock" class="w-3.5 h-3.5" />{{ memberSince(product.profiles?.created_at) }}</p>
                  <p class="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Icon icon="mdi:map-marker" class="w-3.5 h-3.5" />{{ product.profiles?.location }}</p>
                  <p class="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Icon icon="mdi:message-outline" class="w-3.5 h-3.5" />Typically replies within a few hours</p>
                  <div v-if="averageRating" class="flex items-center gap-1 mt-0.5">
                    <span class="text-yellow-400 text-xs">{{ starsDisplay(Math.round(averageRating)) }}</span>
                    <span class="text-xs text-gray-400">{{ averageRating }} ({{ ratings.length }})</span>
                  </div>
                  <p v-else class="text-xs text-gray-400 mt-0.5">No reviews yet</p>
                </div>
              </div>

              <template v-if="user">
                <button v-if="!contactRevealed" @click="revealContact" class="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition text-sm">
                  <Icon icon="mdi:phone" class="w-4 h-4" />Show contact
                </button>
                <a v-else :href="`tel:${formatPhone(product.profiles?.phone)}`" class="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition text-sm">
                  <Icon icon="mdi:phone" class="w-4 h-4" />{{ product.profiles?.phone }}
                </a>
                <button @click="openMessageDrawer" class="flex items-center justify-center gap-2 w-full border-2 border-green-500 text-green-600 hover:bg-green-50 py-3 rounded-xl font-semibold transition text-sm">
                  <Icon icon="mdi:message-outline" class="w-4 h-4" />Send message
                </button>
                <a :href="`https://wa.me/254${product.profiles?.phone?.replace(/\D/g,'').slice(-9)}`" target="_blank"
                  class="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white py-3 rounded-xl font-semibold transition text-sm">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
              </template>
            </div>

            <div class="bg-white rounded-2xl shadow-sm p-4 flex gap-2">
              <button @click="showUnavailableModal = true" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-medium transition">
                Mark unavailable
              </button>
              <button @click="reportListing" class="flex-1 py-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium transition flex items-center justify-center gap-1">
                <Icon icon="mdi:flag-outline" class="w-4 h-4" />Report Abuse
              </button>
            </div>

            <div class="bg-white rounded-2xl shadow-sm p-5">
              <h4 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Icon icon="mdi:shield-check" class="w-5 h-5 text-green-600" />Safety tips
              </h4>
              <ul class="text-sm text-gray-600 space-y-2">
                <li class="flex items-start gap-2"><Icon icon="mdi:circle-small" class="w-4 h-4 shrink-0 mt-0.5" />Avoid paying in advance, even for delivery</li>
                <li class="flex items-start gap-2"><Icon icon="mdi:circle-small" class="w-4 h-4 shrink-0 mt-0.5" />Meet in a safe public place</li>
                <li class="flex items-start gap-2"><Icon icon="mdi:circle-small" class="w-4 h-4 shrink-0 mt-0.5" />Inspect produce before paying</li>
                <li class="flex items-start gap-2"><Icon icon="mdi:circle-small" class="w-4 h-4 shrink-0 mt-0.5" />Never send money in advance</li>
                <li class="flex items-start gap-2"><Icon icon="mdi:circle-small" class="w-4 h-4 shrink-0 mt-0.5" />Deal with people you can verify</li>
                <li class="flex items-start gap-2"><Icon icon="mdi:circle-small" class="w-4 h-4 shrink-0 mt-0.5" />Only pay if you're satisfied</li>
              </ul>
            </div>
          </template>
        </div>
      </div>

      <!-- Listing not found -->
      <div v-else class="text-center py-20">
        <Icon icon="mdi:sprout" class="w-24 h-24 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500 text-lg">Listing not found</p>
        <NuxtLink to="/" class="mt-4 inline-block text-green-600 hover:underline">Back to homepage</NuxtLink>
      </div>

      <!-- Similar listings -->
      <div v-if="!loading && similarListings?.length > 0" class="mt-8">
        <h2 class="text-xl font-bold text-gray-800 mb-4">
          Similar {{ product?.category?.replace(/^\p{Emoji}\s*/u, '') }} listings in {{ product?.location }}
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ProductCard v-for="item in similarListings" :key="item.id" :product="item" />
        </div>
      </div>

    </div>

    <BoostModal v-model="boostModal" :listing="product" :user="user" @boosted="refreshNuxtData('product')" />
    <MessageDrawer v-model="messageDrawerOpen" :listing="product" :user="user" :other-user-id="product?.user_id" />

    <!-- Price History Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showPriceHistory" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center px-4" @click.self="showPriceHistory = false">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Icon icon="mdi:chart-line" class="w-5 h-5 text-green-600" />Price History — {{ product?.title }}
              </h3>
              <button @click="showPriceHistory = false" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition">
                <Icon icon="mdi:close" class="w-5 h-5" />
              </button>
            </div>
            <div class="flex justify-between items-center mb-3 p-3 bg-gray-50 rounded-xl">
              <span class="text-sm text-gray-500">Current price</span>
              <span class="font-bold text-green-600">KSh {{ Number(product?.price).toLocaleString('en-KE') }}</span>
            </div>
            <div v-if="marketData?.live?.min && marketData?.live?.max" class="flex justify-between items-center mb-4 p-3 bg-blue-50 rounded-xl">
              <span class="text-sm text-gray-500">Market price range</span>
              <span class="font-bold text-blue-600">{{ formatPrice(marketData.live.min) }} ~ {{ formatPrice(marketData.live.max) }}</span>
            </div>
            <div v-if="marketData?.history?.length > 1">
              <p class="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1">
                <Icon icon="mdi:trending-up" class="w-4 h-4 text-green-500" />
                {{ product?.category?.replace(/^\p{Emoji}\s*/u, '') }} price trend (last {{ marketData.history.length }} days)
              </p>
              <div class="bg-gray-50 rounded-xl p-4">
                <svg viewBox="0 0 400 100" class="w-full h-28" preserveAspectRatio="none">
                  <line x1="0" y1="25" x2="400" y2="25" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
                  <line x1="0" y1="50" x2="400" y2="50" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
                  <line x1="0" y1="75" x2="400" y2="75" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
                  <path :d="priceHistoryChartPath" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <div class="flex justify-between text-xs text-gray-400 mt-2">
                  <span>{{ marketData.history[0]?.recorded_at }}</span>
                  <span>{{ marketData.history[marketData.history.length - 1]?.recorded_at }}</span>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 text-gray-400 text-sm">Not enough price history data yet.</div>
            <button @click="showPriceHistory = false" class="w-full mt-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition text-sm">Close</button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Mark Unavailable Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showUnavailableModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center px-4" @click.self="showUnavailableModal = false">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center relative">
            <button @click="showUnavailableModal = false" class="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
              <Icon icon="mdi:close" class="w-5 h-5" />
            </button>
            <h3 class="font-bold text-gray-800 text-lg mb-4">Is it not available anymore?</h3>
            <div class="flex justify-center mb-4">
              <div class="relative w-24 h-24">
                <div class="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
                  <Icon icon="mdi:sprout" class="w-12 h-12 text-gray-400" />
                </div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg" style="transform: rotate(-20deg);">UNAVAILABLE</div>
                </div>
              </div>
            </div>
            <p class="text-green-600 text-sm mb-6">We'll do our best to ensure this listing is closed</p>
            <div class="flex gap-4 justify-center">
              <button @click="showUnavailableModal = false" class="px-8 py-2.5 text-green-600 font-bold hover:bg-green-50 rounded-xl transition text-sm">CANCEL</button>
              <button @click="confirmUnavailable" :disabled="reportingUnavailable" class="px-8 py-2.5 text-red-500 font-bold hover:bg-red-50 rounded-xl transition text-sm disabled:opacity-50">
                {{ reportingUnavailable ? 'CONFIRMING...' : 'CONFIRM' }}
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
</style>