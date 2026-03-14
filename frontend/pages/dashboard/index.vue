<script setup>
definePageMeta({ middleware: ['auth', 'no-admin'] })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const { data: listings, refresh } = await useAsyncData('my-listings', async () => {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return data ?? []
})

const { data: allRatings } = await useAsyncData('my-ratings', async () => {
  const { data } = await supabase
    .from('ratings')
    .select('listing_id, score')
    .eq('seller_id', user.id)
  return data ?? []
})

const { data: allStats } = await useAsyncData('my-stats', async () => {
  if (!listings.value?.length) return {}
  const productIds = listings.value.map(l => l.id)
  const [{ data: views }, { data: contacts }] = await Promise.all([
    supabase.from('listing_views').select('product_id').in('product_id', productIds),
    supabase.from('listing_contacts').select('product_id').in('product_id', productIds),
  ])
  const stats = {}
  productIds.forEach(id => { stats[id] = { views: 0, contacts: 0 } })
  views?.forEach(v => { if (stats[v.product_id]) stats[v.product_id].views++ })
  contacts?.forEach(c => { if (stats[c.product_id]) stats[c.product_id].contacts++ })
  return stats
})

const totalStats = computed(() => {
  const s = Object.values(allStats.value ?? {})
  return {
    views: s.reduce((sum, x) => sum + x.views, 0),
    contacts: s.reduce((sum, x) => sum + x.contacts, 0),
  }
})

const ratingsByListing = computed(() => {
  const map = {}
  allRatings.value?.forEach(r => {
    if (!map[r.listing_id]) map[r.listing_id] = { count: 0, total: 0 }
    map[r.listing_id].count++
    map[r.listing_id].total += r.score
  })
  return map
})

const overallRating = computed(() => {
  const all = allRatings.value ?? []
  if (!all.length) return null
  return (all.reduce((sum, r) => sum + r.score, 0) / all.length).toFixed(1)
})

const starsDisplay = (score) =>
  Array.from({ length: 5 }, (_, i) => i + 1 <= Math.round(score) ? '★' : '☆').join('')

const deleteListing = async (id) => {
  if (!confirm('Are you sure you want to delete this listing?')) return
  await supabase.from('products').delete().eq('id', id)
  await refresh()
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
  <ProfileLayout>
    <div class="space-y-4">

      <!-- Stats overview cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-2xl shadow-sm p-4 text-center">
          <p class="text-3xl font-bold text-gray-800">{{ listings?.length ?? 0 }}</p>
          <p class="text-xs text-gray-400 mt-1">📋 Listings</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm p-4 text-center">
          <p class="text-3xl font-bold text-blue-600">{{ totalStats.views }}</p>
          <p class="text-xs text-gray-400 mt-1">👁️ Total Views</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm p-4 text-center">
          <p class="text-3xl font-bold text-green-600">{{ totalStats.contacts }}</p>
          <p class="text-xs text-gray-400 mt-1">📞 Contacts</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm p-4 text-center">
          <p class="text-3xl font-bold text-yellow-500">{{ overallRating ?? '—' }}</p>
          <p class="text-xs text-gray-400 mt-1">⭐ Avg Rating</p>
        </div>
      </div>

      <!-- Listings -->
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden">

        <!-- Header -->
        <div class="flex justify-between items-center px-6 py-5 border-b">
          <div>
            <h2 class="text-xl font-bold text-gray-800">My Adverts</h2>
            <p class="text-sm text-gray-400 mt-0.5">{{ listings?.length ?? 0 }} total</p>
          </div>
          <NuxtLink to="/listings/new"
            class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold transition text-sm">
            + New Listing
          </NuxtLink>
        </div>

        <!-- Overall rating bar -->
        <div v-if="overallRating" class="px-6 py-3 bg-yellow-50 border-b flex items-center gap-3">
          <span class="text-yellow-400 text-lg">{{ starsDisplay(overallRating) }}</span>
          <span class="font-bold text-gray-700">{{ overallRating }}</span>
          <span class="text-xs text-gray-400">
            overall seller rating · {{ allRatings.length }} review{{ allRatings.length === 1 ? '' : 's' }}
          </span>
        </div>

        <!-- Empty state -->
        <div v-if="listings?.length === 0" class="text-center py-24">
          <div class="text-6xl mb-4">🌾</div>
          <p class="text-gray-500 text-lg font-semibold">No listings yet</p>
          <p class="text-gray-400 text-sm mt-1 mb-6">Start selling your produce today!</p>
          <NuxtLink to="/listings/new"
            class="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold transition">
            + Post a Listing
          </NuxtLink>
        </div>

        <!-- Listing rows -->
        <div v-else class="divide-y">
          <div v-for="listing in listings" :key="listing.id"
            class="flex gap-4 px-6 py-5 hover:bg-gray-50 transition group">

            <!-- Image -->
            <NuxtLink :to="`/listings/${listing.id}`"
              class="w-32 h-24 rounded-xl overflow-hidden shrink-0 bg-gray-100">
              <img v-if="listing.image_url" :src="listing.image_url"
                class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
              <div v-else class="w-full h-full flex items-center justify-center text-4xl">🌾</div>
            </NuxtLink>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <NuxtLink :to="`/listings/${listing.id}`">
                <h3 class="font-semibold text-gray-800 truncate hover:text-green-600 transition">
                  {{ listing.title }}
                </h3>
              </NuxtLink>
              <p class="text-green-600 font-bold text-lg mt-0.5">KSh {{ listing.price }}</p>

              <div class="flex items-center gap-3 mt-2 flex-wrap">
                <span class="text-xs px-2 py-1 rounded-full font-semibold"
                  :class="listing.status === 'active' ? 'bg-green-100 text-green-700'
                    : listing.status === 'rejected' ? 'bg-red-100 text-red-600'
                    : 'bg-orange-100 text-orange-600'">
                  {{ listing.status === 'active' ? '✅ Active'
                    : listing.status === 'rejected' ? '❌ Rejected'
                    : '🔄 Reviewing' }}
                </span>
                <span class="text-xs text-gray-400">{{ timeAgo(listing.created_at) }}</span>
                <span v-if="ratingsByListing[listing.id]" class="flex items-center gap-1">
                  <span class="text-yellow-400 text-sm">
                    {{ starsDisplay(ratingsByListing[listing.id].total / ratingsByListing[listing.id].count) }}
                  </span>
                  <span class="text-xs text-gray-400">({{ ratingsByListing[listing.id].count }})</span>
                </span>
              </div>

              <!-- Rejection reason -->
              <div v-if="listing.status === 'rejected' && listing.rejection_reason"
                class="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-600 flex items-start gap-2">
                <span>❌</span>
                <span><span class="font-semibold">Rejected:</span> {{ listing.rejection_reason }}</span>
              </div>

              <!-- Per-listing stats -->
              <div class="flex items-center gap-4 mt-2">
                <span class="flex items-center gap-1 text-xs text-gray-400">
                  <span class="text-blue-400">👁️</span>
                  {{ allStats?.[listing.id]?.views ?? 0 }} views
                </span>
                <span class="flex items-center gap-1 text-xs text-gray-400">
                  <span class="text-green-400">📞</span>
                  {{ allStats?.[listing.id]?.contacts ?? 0 }} contacts
                </span>
                <span class="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
                  📍 {{ listing.location }}
                </span>
                <span class="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
                  {{ listing.category }}
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-col gap-2 shrink-0 justify-center">
              <NuxtLink :to="`/listings/edit/${listing.id}`"
                class="flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm px-4 py-2 rounded-lg transition font-semibold">
                ✏️ Edit
              </NuxtLink>
              <button @click="deleteListing(listing.id)"
                class="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-500 text-sm px-4 py-2 rounded-lg transition font-semibold">
                🗑️ Delete
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  </ProfileLayout>
</template>