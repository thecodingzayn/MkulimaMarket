<script setup>
import { Icon } from '@iconify/vue'

const supabase = useSupabaseClient()
const route = useRoute()
const { data: { user } } = await supabase.auth.getUser()

// Fetch seller profile
const { data: profile } = await useAsyncData('seller-profile', async () => {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, phone, location, avatar_url, created_at')
    .eq('id', route.params.id)
    .single()
  return data
})

if (!profile.value) navigateTo('/')

// Fetch seller's active listings
const { data: listings } = await useAsyncData('seller-listings', async () => {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', route.params.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  return data ?? []
})

// Fetch seller's ratings
const { data: ratings } = await useAsyncData('seller-ratings', async () => {
  const { data } = await supabase
    .from('ratings')
    .select('id, score, comment, created_at, reviewer_id')
    .eq('seller_id', route.params.id)
    .order('created_at', { ascending: false })

  if (!data?.length) return []

  const reviewerIds = [...new Set(data.map(r => r.reviewer_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .in('id', reviewerIds)

  const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) ?? [])
  return data.map(r => ({ ...r, reviewer: profileMap[r.reviewer_id] ?? null }))
})

// Fetch total views and contacts across all seller listings
const { data: stats } = await useAsyncData('seller-stats', async () => {
  if (!listings.value?.length) return { views: 0, contacts: 0 }
  const ids = listings.value.map(l => l.id)
  const [{ count: views }, { count: contacts }] = await Promise.all([
    supabase.from('listing_views').select('*', { count: 'exact', head: true }).in('product_id', ids),
    supabase.from('listing_contacts').select('*', { count: 'exact', head: true }).in('product_id', ids),
  ])
  return { views: views ?? 0, contacts: contacts ?? 0 }
})

const averageRating = computed(() => {
  if (!ratings.value?.length) return null
  return (ratings.value.reduce((a, r) => a + r.score, 0) / ratings.value.length).toFixed(1)
})

const starsDisplay = (score) =>
  Array.from({ length: 5 }, (_, i) => i + 1 <= Math.round(score) ? '★' : '☆').join('')

const memberSince = (date) => {
  if (!date) return null
  const months = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24 * 30))
  if (months < 1) return 'New member'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} on MkulimaMarket`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'} on MkulimaMarket`
}

const timeAgo = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-KE')
}

const isOwnProfile = computed(() => user?.id === route.params.id)
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-5xl mx-auto px-4">

      <button @click="$router.back()"
        class="flex items-center gap-2 text-gray-500 hover:text-green-600 mb-6 transition">
        <Icon icon="mdi:arrow-left" class="w-5 h-5" />
        Back
      </button>

      <div class="flex flex-col md:flex-row gap-6">

        <!-- LEFT: Profile card -->
        <div class="w-full md:w-72 shrink-0 space-y-4">

          <!-- Profile info -->
          <div class="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div class="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 overflow-hidden">
              <img v-if="profile.avatar_url" :src="profile.avatar_url"
                class="w-full h-full object-cover" />
              <Icon v-else icon="mdi:account" class="w-14 h-14 text-green-600" />
            </div>

            <h1 class="text-xl font-bold text-gray-800">{{ profile.name }}</h1>

            <p v-if="profile.location" class="text-sm text-gray-400 mt-1 flex items-center justify-center gap-1">
              <Icon icon="mdi:map-marker" class="w-4 h-4" />
              {{ profile.location }}
            </p>

            <p class="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
              <Icon icon="mdi:account-clock" class="w-3.5 h-3.5" />
              {{ memberSince(profile.created_at) }}
            </p>

            <!-- Rating summary -->
            <div v-if="averageRating" class="mt-4 bg-yellow-50 rounded-xl p-3">
              <p class="text-2xl font-bold text-gray-800">{{ averageRating }}</p>
              <p class="text-yellow-400 text-lg">{{ starsDisplay(averageRating) }}</p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ ratings.length }} review{{ ratings.length === 1 ? '' : 's' }}
              </p>
            </div>
            <div v-else class="mt-4 text-xs text-gray-400">No reviews yet</div>

            <!-- Edit profile (own profile) -->
            <NuxtLink v-if="isOwnProfile" to="/profile/edit"
              class="mt-4 flex items-center justify-center gap-2 w-full border border-gray-200 hover:bg-gray-50 text-gray-600 py-2.5 rounded-xl font-semibold transition text-sm">
              <Icon icon="mdi:pencil" class="w-4 h-4" />
              Edit Profile
            </NuxtLink>
          </div>

          <!-- Stats -->
          <div class="bg-white rounded-2xl shadow-sm p-5">
            <h3 class="font-semibold text-gray-700 mb-3 text-sm">Seller Stats</h3>
            <div class="space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-500 flex items-center gap-2">
                  <Icon icon="mdi:clipboard-list-outline" class="w-4 h-4 text-green-500" />
                  Active listings
                </span>
                <span class="font-bold text-gray-800">{{ listings.length }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-500 flex items-center gap-2">
                  <Icon icon="mdi:eye-outline" class="w-4 h-4 text-blue-500" />
                  Total views
                </span>
                <span class="font-bold text-gray-800">{{ stats.views }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-500 flex items-center gap-2">
                  <Icon icon="mdi:phone-outline" class="w-4 h-4 text-green-500" />
                  Total contacts
                </span>
                <span class="font-bold text-gray-800">{{ stats.contacts }}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- RIGHT: Listings + Reviews -->
        <div class="flex-1 min-w-0 space-y-4">

          <!-- Listings -->
          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b flex items-center justify-between">
              <h2 class="font-bold text-gray-800 text-lg">
                Listings
                <span class="text-sm font-normal text-gray-400 ml-1">({{ listings.length }})</span>
              </h2>
            </div>

            <div v-if="listings.length === 0" class="text-center py-12">
              <Icon icon="mdi:sprout" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p class="text-gray-400 text-sm">No active listings</p>
            </div>

            <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
              <ProductCard v-for="listing in listings" :key="listing.id" :product="listing" />
            </div>
          </div>

          <!-- Reviews -->
          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b">
              <h2 class="font-bold text-gray-800 text-lg">
                Reviews
                <span class="text-sm font-normal text-gray-400 ml-1">({{ ratings.length }})</span>
              </h2>
            </div>

            <div v-if="ratings.length === 0" class="text-center py-12">
              <Icon icon="mdi:star-outline" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p class="text-gray-400 text-sm">No reviews yet</p>
            </div>

            <div v-else class="divide-y">
              <div v-for="rating in ratings" :key="rating.id" class="px-6 py-4">
                <div class="flex items-start gap-3">
                  <div class="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <img v-if="rating.reviewer?.avatar_url"
                      :src="rating.reviewer.avatar_url"
                      class="w-full h-full object-cover rounded-full" />
                    <Icon v-else icon="mdi:account" class="w-5 h-5 text-green-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <p class="font-semibold text-gray-700 text-sm">
                        {{ rating.reviewer?.name ?? 'Anonymous' }}
                      </p>
                      <span class="text-xs text-gray-400 shrink-0">{{ timeAgo(rating.created_at) }}</span>
                    </div>
                    <p class="text-yellow-400 text-sm mt-0.5">
                      {{ starsDisplay(rating.score) }}
                    </p>
                    <p v-if="rating.comment" class="text-sm text-gray-600 mt-1">
                      "{{ rating.comment }}"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>