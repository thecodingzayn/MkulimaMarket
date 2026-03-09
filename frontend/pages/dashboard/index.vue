<script setup>
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const router = useRouter()

const { data: { user } } = await supabase.auth.getUser()
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single()

const { data: listings, refresh } = await useAsyncData('my-listings', async () => {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return data ?? []
})

// Fetch all ratings for this seller's listings in one query
const { data: allRatings } = await useAsyncData('my-ratings', async () => {
  const { data } = await supabase
    .from('ratings')
    .select('listing_id, score')
    .eq('seller_id', user.id)
  return data ?? []
})

// Build a map: listing_id → { count, average }
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
  const avg = all.reduce((sum, r) => sum + r.score, 0) / all.length
  return avg.toFixed(1)
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
  if(diff < 172800) return `yesterday`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  return new Date(date).toLocaleDateString('en-KE')
}
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-6xl mx-auto px-4">
      <div class="flex flex-col md:flex-row gap-6">

        <!-- Sidebar -->
        <div class="w-full md:w-72 shrink-0 space-y-4">

          <!-- Profile Card -->
          <div class="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div class="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <span class="text-5xl">👤</span>
            </div>
            <h2 class="font-bold text-gray-800 text-lg">{{ profile?.name }}</h2>
            <p class="text-sm text-gray-400 mt-1">📍 {{ profile?.location }}</p>
            <p class="text-sm text-gray-400 mt-1">📞 {{ profile?.phone }}</p>

            <!-- Overall rating -->
            <div v-if="overallRating" class="mt-3 bg-yellow-50 rounded-xl py-2 px-3">
              <p class="text-yellow-500 text-lg">{{ starsDisplay(overallRating) }}</p>
              <p class="text-sm font-bold text-gray-700">{{ overallRating }} seller rating</p>
              <p class="text-xs text-gray-400">{{ allRatings.length }} review{{ allRatings.length === 1 ? '' : 's' }}</p>
            </div>

            <div class="border-t mt-4 pt-4">
              <p class="text-xs text-gray-400">
                {{ listings?.length ?? 0 }} listing{{ listings?.length === 1 ? '' : 's' }}
              </p>
            </div>
          </div>

          <!-- Menu -->
          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
            <NuxtLink to="/dashboard"
              class="flex items-center gap-3 px-5 py-4 text-green-600 font-semibold border-l-4 border-green-600 bg-green-50">
              <span>📋</span> My Listings
            </NuxtLink>
            <NuxtLink to="/profile/edit"
              class="flex items-center gap-3 px-5 py-4 text-gray-600 hover:bg-gray-50 border-l-4 border-transparent transition">
              <span>⚙️</span> Settings
            </NuxtLink>
          </div>

          <NuxtLink to="/listings/new"
            class="block w-full bg-orange-500 hover:bg-orange-600 text-white text-center py-3 rounded-2xl font-semibold transition shadow-sm">
            + Post New Listing
          </NuxtLink>
        </div>

        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          <div class="bg-white rounded-2xl shadow-sm p-6">

            <div class="flex justify-between items-center border-b pb-4 mb-6">
              <h2 class="text-xl font-bold text-gray-800">My Listings</h2>
              <span class="text-sm text-gray-400">{{ listings?.length ?? 0 }} total</span>
            </div>

            <!-- Empty state -->
            <div v-if="listings?.length === 0" class="text-center py-20">
              <div class="text-6xl mb-4">🌾</div>
              <p class="text-gray-500 text-lg font-semibold">No listings yet</p>
              <p class="text-gray-400 text-sm mt-1 mb-6">Start selling your produce today!</p>
              <NuxtLink to="/listings/new"
                class="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold transition">
                + Post a Listing
              </NuxtLink>
            </div>

            <!-- Listings -->
            <div v-else class="space-y-4">
              <div v-for="listing in listings" :key="listing.id"
                class="flex flex-col sm:flex-row gap-4 border border-gray-100 rounded-xl p-4 hover:border-green-200 hover:shadow-sm transition">

                <!-- Image -->
                <NuxtLink :to="`/listings/${listing.id}`"
                  class="w-full sm:w-36 h-40 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                  <img v-if="listing.image_url" :src="listing.image_url"
                    class="w-full h-full object-cover hover:scale-105 transition duration-300" />
                  <div v-else class="w-full h-full flex items-center justify-center text-4xl">🌾</div>
                </NuxtLink>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <NuxtLink :to="`/listings/${listing.id}`">
                    <h3 class="font-semibold text-gray-800 text-lg truncate hover:text-green-600 transition">
                      {{ listing.title }}
                    </h3>
                  </NuxtLink>
                  <p class="text-green-600 font-bold text-xl mt-1">KSh {{ listing.price }}</p>

                  <div class="flex items-center gap-3 mt-2 flex-wrap">
                    <span class="text-xs px-2 py-1 rounded-full font-semibold"
                      :class="listing.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'">
                      {{ listing.status === 'active' ? '✅ Active' : '🔄 Reviewing' }}
                    </span>
                    <span class="text-xs text-gray-400">Created {{ timeAgo(listing.created_at) }}</span>

                    <!-- Per-listing rating -->
                    <span v-if="ratingsByListing[listing.id]" class="flex items-center gap-1">
                      <span class="text-yellow-400 text-sm">
                        {{ starsDisplay(ratingsByListing[listing.id].total / ratingsByListing[listing.id].count) }}
                      </span>
                      <span class="text-xs text-gray-400">
                        ({{ ratingsByListing[listing.id].count }})
                      </span>
                    </span>
                    <span v-else class="text-xs text-gray-300">No reviews</span>
                  </div>

                  <div class="flex flex-wrap gap-2 mt-2">
                    <span class="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">📍 {{ listing.location }}</span>
                    <span class="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">{{ listing.category }}</span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex sm:flex-col gap-2 shrink-0 justify-end">
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

      </div>
    </div>
  </div>
</template>