<script setup>
import { Icon } from '@iconify/vue'

definePageMeta({ middleware: 'admin' })

const supabase = useSupabaseClient()

const logout = async () => {
  await supabase.auth.signOut()
  navigateTo('/auth/login')
}

const activeTab = ref('reviewing')
const statsTab = ref('overview')
const tabs = [
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'active', label: 'Active' },
  { key: 'rejected', label: 'Rejected' },
]

// ── LISTINGS ──────────────────────────────────────────────────────────────────
const { data: listings, refresh } = await useAsyncData('admin-listings', async () => {
  const { data } = await supabase
    .from('products')
    .select('*, listing_images(id, url, position)')
    .order('created_at', { ascending: false })

  if (!data?.length) return []

  const ownerIds = [...new Set(data.map(l => l.user_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .in('id', ownerIds)

  const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) ?? [])
  return data.map(l => ({ ...l, profile: profileMap[l.user_id] ?? null }))
})

// ── DASHBOARD STATS ───────────────────────────────────────────────────────────
const { data: stats } = await useAsyncData('admin-stats', async () => {
  // Total users
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  // New users this week
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: newUsersThisWeek } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneWeekAgo)

  // Total messages
  const { count: totalMessages } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })

  // Messages this week
  const { count: messagesThisWeek } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneWeekAgo)

  // Total conversations
  const { count: totalConversations } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })

  // Total views
  const { count: totalViews } = await supabase
    .from('listing_views')
    .select('id', { count: 'exact', head: true })

  // Total contacts
  const { count: totalContacts } = await supabase
    .from('listing_contacts')
    .select('id', { count: 'exact', head: true })

  // Total boost revenue
  const { data: boosts } = await supabase
    .from('boosts')
    .select('amount')
    .eq('status', 'confirmed')

  const totalRevenue = boosts?.reduce((sum, b) => sum + Number(b.amount), 0) ?? 0

  // Total boosts confirmed
  const totalBoosts = boosts?.length ?? 0

  // Transport requests
  const { count: totalTransportRequests } = await supabase
    .from('transport_requests')
    .select('id', { count: 'exact', head: true })

  const { count: assignedTransport } = await supabase
    .from('transport_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'assigned')

  // Ratings
  const { data: ratings } = await supabase
    .from('ratings')
    .select('score')

  const avgRating = ratings?.length
    ? (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(1)
    : null

  // Listings posted this week
  const { count: listingsThisWeek } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneWeekAgo)

  // Category breakdown
  const { data: allListings } = await supabase
    .from('products')
    .select('category, status')
    .eq('status', 'active')

  const categoryBreakdown = {}
  allListings?.forEach(l => {
    const label = l.category?.replace(/^\p{Emoji}\s*/u, '') ?? 'Unknown'
    categoryBreakdown[label] = (categoryBreakdown[label] || 0) + 1
  })

  const topCategories = Object.entries(categoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return {
    totalUsers,
    newUsersThisWeek,
    totalMessages,
    messagesThisWeek,
    totalConversations,
    totalViews,
    totalContacts,
    totalRevenue,
    totalBoosts,
    totalTransportRequests,
    assignedTransport,
    avgRating,
    totalRatings: ratings?.length ?? 0,
    listingsThisWeek,
    topCategories,
  }
})

// ── LISTING HELPERS ───────────────────────────────────────────────────────────
const coverImage = (listing) => {
  const imgs = listing.listing_images
  if (!imgs?.length) return null
  return [...imgs].sort((a, b) => a.position - b.position)[0]?.url ?? null
}

const filteredListings = computed(() =>
  listings.value?.filter(l => l.status === activeTab.value) ?? []
)

const counts = computed(() => ({
  reviewing: listings.value?.filter(l => l.status === 'reviewing').length ?? 0,
  active: listings.value?.filter(l => l.status === 'active').length ?? 0,
  rejected: listings.value?.filter(l => l.status === 'rejected').length ?? 0,
}))

const rejectModal = ref(false)
const rejectTarget = ref(null)
const rejectReason = ref('')
const actionLoading = ref(null)

const approveListing = async (id) => {
  actionLoading.value = id
  await supabase.from('products').update({ status: 'active', rejection_reason: null, review_reason: null }).eq('id', id)
  await refresh()
  actionLoading.value = null
}

const deleteListing = async (id) => {
  if (!confirm('Are you sure you want to permanently delete this listing?')) return
  actionLoading.value = id
  await supabase.from('products').delete().eq('id', id)
  await refresh()
  actionLoading.value = null
}

const openRejectModal = (listing) => {
  rejectTarget.value = listing
  rejectReason.value = ''
  rejectModal.value = true
}

const confirmReject = async () => {
  if (!rejectTarget.value) return
  actionLoading.value = rejectTarget.value.id
  await supabase.from('products')
    .update({ status: 'rejected', rejection_reason: rejectReason.value || 'Did not meet our guidelines.', review_reason: null })
    .eq('id', rejectTarget.value.id)
  rejectModal.value = false
  rejectTarget.value = null
  rejectReason.value = ''
  await refresh()
  actionLoading.value = null
}

const reviewReasonLabel = (reason) => {
  if (reason === 'flagged_unavailable') return { text: 'Flagged unavailable', icon: 'mdi:flag', class: 'bg-red-100 text-red-600' }
  if (reason === 'updated_listing') return { text: 'Updated listing', icon: 'mdi:pencil', class: 'bg-blue-100 text-blue-600' }
  if (reason === 'new_listing') return { text: 'New listing', icon: 'mdi:new-box', class: 'bg-orange-100 text-orange-600' }
  return { text: 'Under review', icon: 'mdi:clock-outline', class: 'bg-gray-100 text-gray-500' }
}

const timeAgo = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-KE')
}

const formatNumber = (n) => Number(n ?? 0).toLocaleString('en-KE')
</script>

<template>
  <div class="bg-gray-100 min-h-screen">

    <!-- Navbar -->
    <div class="bg-green-700 text-white px-6 py-4 flex items-center justify-between shadow">
      <div class="flex items-center gap-3">
        <Icon icon="mdi:shield-check" class="w-6 h-6" />
        <h1 class="font-bold text-lg">MkulimaMarket Admin</h1>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-green-200">Admin Panel</span>
        <button @click="logout"
          class="flex items-center gap-2 bg-white text-green-700 hover:bg-green-50 text-sm font-semibold px-4 py-2 rounded-lg transition">
          <Icon icon="mdi:logout" class="w-4 h-4" />
          Log out
        </button>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-4 py-8 space-y-6">

      <!-- ── STATS TABS ─────────────────────────────────────────────────────── -->
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden">

        <!-- Tab bar -->
        <div class="flex border-b">
          <button v-for="tab in [
            { key: 'overview', label: 'Overview', icon: 'mdi:chart-box-outline' },
            { key: 'listings', label: 'Listings', icon: 'mdi:clipboard-list-outline' },
            { key: 'engagement', label: 'Engagement', icon: 'mdi:account-group-outline' },
            { key: 'revenue', label: 'Revenue', icon: 'mdi:cash' },
          ]" :key="tab.key"
            @click="statsTab = tab.key"
            class="flex-1 py-3 text-xs md:text-sm font-semibold transition flex items-center justify-center gap-1.5"
            :class="statsTab === tab.key
              ? 'border-b-2 border-green-600 text-green-700 bg-green-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'">
            <Icon :icon="tab.icon" class="w-4 h-4" />
            {{ tab.label }}
          </button>
        </div>

        <div class="p-5">

          <!-- OVERVIEW TAB -->
          <div v-if="statsTab === 'overview'" class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-blue-50 rounded-2xl p-4 text-center">
              <Icon icon="mdi:account-group" class="w-7 h-7 text-blue-500 mx-auto mb-2" />
              <p class="text-2xl font-bold text-gray-800">{{ formatNumber(stats?.totalUsers) }}</p>
              <p class="text-xs text-gray-400 mt-1">Total Users</p>
              <p v-if="stats?.newUsersThisWeek" class="text-xs text-blue-500 mt-1 font-medium">
                +{{ stats.newUsersThisWeek }} this week
              </p>
            </div>
            <div class="bg-green-50 rounded-2xl p-4 text-center">
              <Icon icon="mdi:clipboard-list-outline" class="w-7 h-7 text-green-500 mx-auto mb-2" />
              <p class="text-2xl font-bold text-gray-800">{{ formatNumber(counts.active) }}</p>
              <p class="text-xs text-gray-400 mt-1">Active Listings</p>
              <p v-if="stats?.listingsThisWeek" class="text-xs text-green-500 mt-1 font-medium">
                +{{ stats.listingsThisWeek }} this week
              </p>
            </div>
            <div class="bg-purple-50 rounded-2xl p-4 text-center">
              <Icon icon="mdi:message-outline" class="w-7 h-7 text-purple-500 mx-auto mb-2" />
              <p class="text-2xl font-bold text-gray-800">{{ formatNumber(stats?.totalMessages) }}</p>
              <p class="text-xs text-gray-400 mt-1">Total Messages</p>
              <p v-if="stats?.messagesThisWeek" class="text-xs text-purple-500 mt-1 font-medium">
                +{{ stats.messagesThisWeek }} this week
              </p>
            </div>
            <div class="bg-orange-50 rounded-2xl p-4 text-center">
              <Icon icon="mdi:cash" class="w-7 h-7 text-orange-500 mx-auto mb-2" />
              <p class="text-2xl font-bold text-gray-800">KSh {{ formatNumber(stats?.totalRevenue) }}</p>
              <p class="text-xs text-gray-400 mt-1">Boost Revenue</p>
              <p v-if="stats?.totalBoosts" class="text-xs text-orange-500 mt-1 font-medium">
                {{ stats.totalBoosts }} boost{{ stats.totalBoosts === 1 ? '' : 's' }} confirmed
              </p>
            </div>
          </div>

          <!-- LISTINGS TAB -->
          <div v-else-if="statsTab === 'listings'">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div class="bg-orange-50 rounded-2xl p-4 text-center">
                <p class="text-2xl font-bold text-orange-500">{{ counts.reviewing }}</p>
                <p class="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                  <Icon icon="mdi:clock-outline" class="w-3.5 h-3.5" />
                  Pending Review
                </p>
              </div>
              <div class="bg-green-50 rounded-2xl p-4 text-center">
                <p class="text-2xl font-bold text-green-600">{{ counts.active }}</p>
                <p class="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                  <Icon icon="mdi:check-circle" class="w-3.5 h-3.5" />
                  Active
                </p>
              </div>
              <div class="bg-red-50 rounded-2xl p-4 text-center">
                <p class="text-2xl font-bold text-red-500">{{ counts.rejected }}</p>
                <p class="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                  <Icon icon="mdi:close-circle" class="w-3.5 h-3.5" />
                  Rejected
                </p>
              </div>
              <div class="bg-blue-50 rounded-2xl p-4 text-center">
                <p class="text-2xl font-bold text-blue-600">{{ formatNumber((counts.active ?? 0) + (counts.reviewing ?? 0) + (counts.rejected ?? 0)) }}</p>
                <p class="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                  <Icon icon="mdi:format-list-bulleted" class="w-3.5 h-3.5" />
                  Total Listings
                </p>
              </div>
            </div>

            <!-- Top categories -->
            <div v-if="stats?.topCategories?.length">
              <p class="text-sm font-semibold text-gray-700 mb-3">Top Categories by Active Listings</p>
              <div class="space-y-2">
                <div v-for="[cat, count] in stats.topCategories" :key="cat"
                  class="flex items-center gap-3">
                  <p class="text-sm text-gray-600 w-36 shrink-0 truncate">{{ cat }}</p>
                  <div class="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div class="bg-green-500 h-2.5 rounded-full transition-all"
                      :style="{ width: `${(count / stats.topCategories[0][1]) * 100}%` }"></div>
                  </div>
                  <p class="text-sm font-bold text-gray-700 w-8 text-right shrink-0">{{ count }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- ENGAGEMENT TAB -->
          <div v-else-if="statsTab === 'engagement'" class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div class="bg-blue-50 rounded-2xl p-4 text-center">
              <Icon icon="mdi:eye-outline" class="w-7 h-7 text-blue-500 mx-auto mb-2" />
              <p class="text-2xl font-bold text-gray-800">{{ formatNumber(stats?.totalViews) }}</p>
              <p class="text-xs text-gray-400 mt-1">Total Listing Views</p>
            </div>
            <div class="bg-green-50 rounded-2xl p-4 text-center">
              <Icon icon="mdi:phone-outline" class="w-7 h-7 text-green-500 mx-auto mb-2" />
              <p class="text-2xl font-bold text-gray-800">{{ formatNumber(stats?.totalContacts) }}</p>
              <p class="text-xs text-gray-400 mt-1">Contact Reveals</p>
            </div>
            <div class="bg-purple-50 rounded-2xl p-4 text-center">
              <Icon icon="mdi:message-outline" class="w-7 h-7 text-purple-500 mx-auto mb-2" />
              <p class="text-2xl font-bold text-gray-800">{{ formatNumber(stats?.totalConversations) }}</p>
              <p class="text-xs text-gray-400 mt-1">Conversations</p>
            </div>
            <div class="bg-yellow-50 rounded-2xl p-4 text-center">
              <Icon icon="mdi:star-outline" class="w-7 h-7 text-yellow-500 mx-auto mb-2" />
              <p class="text-2xl font-bold text-gray-800">{{ stats?.avgRating ?? '—' }}</p>
              <p class="text-xs text-gray-400 mt-1">Avg Seller Rating</p>
              <p v-if="stats?.totalRatings" class="text-xs text-yellow-500 mt-1 font-medium">
                {{ stats.totalRatings }} review{{ stats.totalRatings === 1 ? '' : 's' }}
              </p>
            </div>
            <div class="bg-indigo-50 rounded-2xl p-4 text-center">
              <Icon icon="mdi:truck-outline" class="w-7 h-7 text-indigo-500 mx-auto mb-2" />
              <p class="text-2xl font-bold text-gray-800">{{ formatNumber(stats?.totalTransportRequests) }}</p>
              <p class="text-xs text-gray-400 mt-1">Transport Requests</p>
              <p v-if="stats?.assignedTransport" class="text-xs text-indigo-500 mt-1 font-medium">
                {{ stats.assignedTransport }} assigned
              </p>
            </div>
            <div class="bg-gray-50 rounded-2xl p-4 text-center">
              <Icon icon="mdi:account-group" class="w-7 h-7 text-gray-500 mx-auto mb-2" />
              <p class="text-2xl font-bold text-gray-800">{{ formatNumber(stats?.totalUsers) }}</p>
              <p class="text-xs text-gray-400 mt-1">Registered Users</p>
              <p v-if="stats?.newUsersThisWeek" class="text-xs text-gray-500 mt-1 font-medium">
                +{{ stats.newUsersThisWeek }} this week
              </p>
            </div>
          </div>

          <!-- REVENUE TAB -->
          <div v-else-if="statsTab === 'revenue'">
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div class="bg-orange-50 rounded-2xl p-4 text-center">
                <Icon icon="mdi:cash" class="w-7 h-7 text-orange-500 mx-auto mb-2" />
                <p class="text-2xl font-bold text-gray-800">KSh {{ formatNumber(stats?.totalRevenue) }}</p>
                <p class="text-xs text-gray-400 mt-1">Total Boost Revenue</p>
              </div>
              <div class="bg-yellow-50 rounded-2xl p-4 text-center">
                <Icon icon="mdi:fire" class="w-7 h-7 text-yellow-500 mx-auto mb-2" />
                <p class="text-2xl font-bold text-gray-800">{{ formatNumber(stats?.totalBoosts) }}</p>
                <p class="text-xs text-gray-400 mt-1">Confirmed Boosts</p>
              </div>
              <div class="bg-green-50 rounded-2xl p-4 text-center">
                <Icon icon="mdi:cash-multiple" class="w-7 h-7 text-green-500 mx-auto mb-2" />
                <p class="text-2xl font-bold text-gray-800">
                  KSh {{ stats?.totalBoosts ? formatNumber(Math.round((stats.totalRevenue ?? 0) / stats.totalBoosts)) : '—' }}
                </p>
                <p class="text-xs text-gray-400 mt-1">Avg Revenue per Boost</p>
              </div>
            </div>

            <div class="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 flex items-start gap-2">
              <Icon icon="mdi:information-outline" class="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
              Revenue figures are based on confirmed M-Pesa STK push payments only. Pending and failed transactions are excluded.
            </div>
          </div>

        </div>
      </div>

      <!-- ── LISTINGS TABLE ──────────────────────────────────────────────────── -->
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden">

        <div class="flex border-b">
          <button v-for="tab in tabs" :key="tab.key" @click="activeTab = tab.key"
            class="flex-1 py-4 text-sm font-semibold transition flex items-center justify-center gap-2"
            :class="activeTab === tab.key ? 'border-b-2 border-green-600 text-green-700 bg-green-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'">
            <Icon :icon="tab.key === 'reviewing' ? 'mdi:clock-outline' : tab.key === 'active' ? 'mdi:check-circle' : 'mdi:close-circle'" class="w-4 h-4" />
            {{ tab.label }}
            <span class="text-xs px-2 py-0.5 rounded-full font-bold"
              :class="activeTab === tab.key ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
              {{ counts[tab.key] }}
            </span>
          </button>
        </div>

        <div v-if="filteredListings.length === 0" class="text-center py-20">
          <Icon icon="mdi:inbox-outline" class="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p class="text-gray-400 font-semibold">No {{ activeTab }} listings</p>
        </div>

        <div v-else class="divide-y">
          <div v-for="listing in filteredListings" :key="listing.id"
            class="flex gap-4 px-6 py-5 hover:bg-gray-50 transition">

            <div class="w-24 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100">
              <img v-if="coverImage(listing)" :src="coverImage(listing)" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Icon icon="mdi:sprout" class="w-8 h-8 text-gray-300" />
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <NuxtLink :to="`/listings/${listing.id}`" target="_blank"
                  class="font-semibold text-gray-800 hover:text-green-600 transition hover:underline">
                  {{ listing.title }}
                </NuxtLink>
                <span class="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                  :class="listing.status === 'active' ? 'bg-green-100 text-green-700' : listing.status === 'reviewing' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'">
                  <Icon :icon="listing.status === 'active' ? 'mdi:check-circle' : listing.status === 'reviewing' ? 'mdi:clock-outline' : 'mdi:close-circle'" class="w-3 h-3" />
                  {{ listing.status }}
                </span>
                <span v-if="listing.listing_images?.length > 1" class="text-xs text-gray-400 flex items-center gap-1">
                  <Icon icon="mdi:image-multiple" class="w-3.5 h-3.5" />
                  {{ listing.listing_images.length }} photos
                </span>
                <span v-if="listing.status === 'reviewing' && listing.review_reason"
                  class="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                  :class="reviewReasonLabel(listing.review_reason).class">
                  <Icon :icon="reviewReasonLabel(listing.review_reason).icon" class="w-3 h-3" />
                  {{ reviewReasonLabel(listing.review_reason).text }}
                </span>
              </div>

              <p class="text-green-600 font-bold mt-0.5">KSh {{ Number(listing.price).toLocaleString('en-KE') }}</p>

              <div class="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                <NuxtLink :to="`/profile/${listing.user_id}`" target="_blank"
                  class="flex items-center gap-1 hover:text-green-600 transition">
                  <Icon icon="mdi:account" class="w-3.5 h-3.5" />
                  {{ listing.profile?.name ?? 'Unknown' }}
                </NuxtLink>
                <span class="flex items-center gap-1">
                  <Icon icon="mdi:phone" class="w-3.5 h-3.5" />
                  {{ listing.profile?.phone ?? '—' }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon icon="mdi:map-marker" class="w-3.5 h-3.5" />
                  {{ listing.location }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon icon="mdi:tag" class="w-3.5 h-3.5" />
                  {{ listing.category?.replace(/^\p{Emoji}\s*/u, '') }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon icon="mdi:clock-outline" class="w-3.5 h-3.5" />
                  {{ timeAgo(listing.created_at) }}
                </span>
              </div>

              <div v-if="listing.review_reason === 'flagged_unavailable'"
                class="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-600 flex items-start gap-2">
                <Icon icon="mdi:flag" class="w-4 h-4 shrink-0 mt-0.5" />
                A user reported this listing as no longer available.
              </div>
              <div v-if="listing.status === 'rejected' && listing.rejection_reason"
                class="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-600 flex items-start gap-2">
                <Icon icon="mdi:close-circle" class="w-4 h-4 shrink-0 mt-0.5" />
                Reason: {{ listing.rejection_reason }}
              </div>
            </div>

            <div class="flex flex-col gap-2 shrink-0 justify-center">
              <template v-if="listing.status === 'reviewing'">
                <button @click="approveListing(listing.id)" :disabled="actionLoading === listing.id"
                  class="flex items-center justify-center gap-1 bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition font-semibold disabled:opacity-50">
                  <Icon v-if="actionLoading !== listing.id" icon="mdi:check" class="w-4 h-4" />
                  {{ actionLoading === listing.id ? '...' : 'Approve' }}
                </button>
                <button @click="openRejectModal(listing)" :disabled="actionLoading === listing.id"
                  class="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-500 text-sm px-4 py-2 rounded-lg transition font-semibold disabled:opacity-50">
                  <Icon icon="mdi:close" class="w-4 h-4" />
                  Reject
                </button>
              </template>
              <template v-else-if="listing.status === 'rejected'">
                <button @click="approveListing(listing.id)" :disabled="actionLoading === listing.id"
                  class="flex items-center justify-center gap-1 bg-green-50 hover:bg-green-100 text-green-600 text-sm px-4 py-2 rounded-lg transition font-semibold disabled:opacity-50">
                  <Icon v-if="actionLoading !== listing.id" icon="mdi:check" class="w-4 h-4" />
                  {{ actionLoading === listing.id ? '...' : 'Approve' }}
                </button>
              </template>
              <template v-else-if="listing.status === 'active'">
                <button @click="openRejectModal(listing)" :disabled="actionLoading === listing.id"
                  class="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-500 text-sm px-4 py-2 rounded-lg transition font-semibold disabled:opacity-50">
                  <Icon icon="mdi:close" class="w-4 h-4" />
                  Reject
                </button>
              </template>
              <button @click="deleteListing(listing.id)" :disabled="actionLoading === listing.id"
                class="flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg transition font-semibold disabled:opacity-50">
                <Icon icon="mdi:delete-outline" class="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Reject Modal -->
    <div v-if="rejectModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" @click.self="rejectModal = false">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="font-bold text-gray-800 text-lg mb-1">Reject Listing</h3>
        <p class="text-sm text-gray-500 mb-4">
          Rejecting: <span class="font-semibold text-gray-700">{{ rejectTarget?.title }}</span>
        </p>
        <div v-if="rejectTarget?.review_reason"
          class="mb-4 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
          :class="reviewReasonLabel(rejectTarget.review_reason).class">
          <Icon :icon="reviewReasonLabel(rejectTarget.review_reason).icon" class="w-4 h-4 shrink-0" />
          {{ reviewReasonLabel(rejectTarget.review_reason).text }}
        </div>
        <label class="text-sm font-semibold text-gray-700 mb-2 block">Reason for rejection</label>
        <textarea v-model="rejectReason" rows="3"
          placeholder="e.g. Image is unclear, price is missing, prohibited item..."
          class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4" />
        <div class="flex gap-3">
          <button @click="rejectModal = false"
            class="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition text-sm">
            Cancel
          </button>
          <button @click="confirmReject" :disabled="actionLoading !== null"
            class="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition text-sm disabled:opacity-50">
            {{ actionLoading !== null ? 'Rejecting...' : 'Confirm Reject' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>