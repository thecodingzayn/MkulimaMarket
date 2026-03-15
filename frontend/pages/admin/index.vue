<script setup>
definePageMeta({ middleware: 'admin' })

const supabase = useSupabaseClient()

const logout = async () => {
  await supabase.auth.signOut()
  navigateTo('/auth/login')
}

const activeTab = ref('reviewing')
const tabs = [
  { key: 'reviewing', label: '🔄 Reviewing' },
  { key: 'active', label: '✅ Active' },
  { key: 'rejected', label: '❌ Rejected' },
]

const { data: listings, refresh } = await useAsyncData('admin-listings', async () => {
  const { data } = await supabase
    .from('products')
    .select('*')
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
  await supabase.from('products')
    .update({ status: 'active', rejection_reason: null, review_reason: null })
    .eq('id', id)
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
    .update({
      status: 'rejected',
      rejection_reason: rejectReason.value || 'Did not meet our guidelines.',
      review_reason: null
    })
    .eq('id', rejectTarget.value.id)
  rejectModal.value = false
  rejectTarget.value = null
  rejectReason.value = ''
  await refresh()
  actionLoading.value = null
}

const reviewReasonLabel = (reason) => {
  if (reason === 'flagged_unavailable') return { text: '🚩 Flagged unavailable', class: 'bg-red-100 text-red-600' }
  if (reason === 'updated_listing') return { text: '✏️ Updated listing', class: 'bg-blue-100 text-blue-600' }
  if (reason === 'new_listing') return { text: '🆕 New listing', class: 'bg-orange-100 text-orange-600' }
  return { text: '🔄 Under review', class: 'bg-gray-100 text-gray-500' }
}

const timeAgo = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-KE')
}
</script>

<template>
  <div class="bg-gray-100 min-h-screen">

    <!-- Admin Navbar -->
    <div class="bg-green-700 text-white px-6 py-4 flex items-center justify-between shadow">
      <div class="flex items-center gap-3">
        <h1 class="font-bold text-lg">🛡️ MkulimaMarket Admin</h1>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-green-200">Admin Panel</span>
        <button @click="logout"
          class="bg-white text-green-700 hover:bg-green-50 text-sm font-semibold px-4 py-2 rounded-lg transition">
          🚪 Logout
        </button>
      </div>
    </div>

    <!-- Main content -->
    <div class="max-w-6xl mx-auto px-4 py-8">

      <!-- Stats row -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-2xl shadow-sm p-5 text-center">
          <p class="text-3xl font-bold text-orange-500">{{ counts.reviewing }}</p>
          <p class="text-sm text-gray-400 mt-1">🔄 Pending Review</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm p-5 text-center">
          <p class="text-3xl font-bold text-green-600">{{ counts.active }}</p>
          <p class="text-sm text-gray-400 mt-1">✅ Active</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm p-5 text-center">
          <p class="text-3xl font-bold text-red-500">{{ counts.rejected }}</p>
          <p class="text-sm text-gray-400 mt-1">❌ Rejected</p>
        </div>
      </div>

      <!-- Listings table -->
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden">

        <!-- Tabs -->
        <div class="flex border-b">
          <button v-for="tab in tabs" :key="tab.key"
            @click="activeTab = tab.key"
            class="flex-1 py-4 text-sm font-semibold transition flex items-center justify-center gap-2"
            :class="activeTab === tab.key
              ? 'border-b-2 border-green-600 text-green-700 bg-green-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'">
            {{ tab.label }}
            <span class="text-xs px-2 py-0.5 rounded-full font-bold"
              :class="activeTab === tab.key
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'">
              {{ counts[tab.key] }}
            </span>
          </button>
        </div>

        <!-- Empty state -->
        <div v-if="filteredListings.length === 0" class="text-center py-20">
          <div class="text-5xl mb-3">📭</div>
          <p class="text-gray-400 font-semibold">No {{ activeTab }} listings</p>
        </div>

        <!-- Listing rows -->
        <div v-else class="divide-y">
          <div v-for="listing in filteredListings" :key="listing.id"
            class="flex gap-4 px-6 py-5 hover:bg-gray-50 transition">

            <!-- Image -->
            <div class="w-24 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100">
              <img v-if="listing.image_url" :src="listing.image_url" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-3xl">🌾</div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <NuxtLink :to="`/listings/${listing.id}`" target="_blank"
                  class="font-semibold text-gray-800 hover:text-green-600 transition hover:underline">
                  {{ listing.title }}
                </NuxtLink>
                <span class="text-xs px-2 py-0.5 rounded-full font-semibold"
                  :class="listing.status === 'active' ? 'bg-green-100 text-green-700'
                    : listing.status === 'reviewing' ? 'bg-orange-100 text-orange-600'
                    : 'bg-red-100 text-red-600'">
                  {{ listing.status }}
                </span>

                <!-- Review reason badge -->
                <span v-if="listing.status === 'reviewing' && listing.review_reason"
                  class="text-xs px-2 py-0.5 rounded-full font-semibold"
                  :class="reviewReasonLabel(listing.review_reason).class">
                  {{ reviewReasonLabel(listing.review_reason).text }}
                </span>
              </div>

              <p class="text-green-600 font-bold mt-0.5">
                KSh {{ Number(listing.price).toLocaleString('en-KE') }}
              </p>

              <div class="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                <span>👤 {{ listing.profile?.name ?? 'Unknown' }}</span>
                <span>📞 {{ listing.profile?.phone ?? '—' }}</span>
                <span>📍 {{ listing.location }}</span>
                <span>🏷️ {{ listing.category }}</span>
                <span>🕒 {{ timeAgo(listing.created_at) }}</span>
              </div>

              <!-- Flagged unavailable explanation -->
              <div v-if="listing.review_reason === 'flagged_unavailable'"
                class="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-600">
                🚩 A user reported this listing as no longer available. Please verify and approve or reject.
              </div>

              <!-- Rejection reason -->
              <div v-if="listing.status === 'rejected' && listing.rejection_reason"
                class="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-600">
                ❌ Reason: {{ listing.rejection_reason }}
              </div>
            </div>

<!-- Actions -->
<div class="flex flex-col gap-2 shrink-0 justify-center">

  <template v-if="listing.status === 'reviewing'">
    <button @click="approveListing(listing.id)"
      :disabled="actionLoading === listing.id"
      class="flex items-center justify-center gap-1 bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition font-semibold disabled:opacity-50">
      {{ actionLoading === listing.id ? '...' : '✅ Approve' }}
    </button>
    <button @click="openRejectModal(listing)"
      :disabled="actionLoading === listing.id"
      class="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-500 text-sm px-4 py-2 rounded-lg transition font-semibold disabled:opacity-50">
      ❌ Reject
    </button>
  </template>

  <template v-else-if="listing.status === 'rejected'">
    <button @click="approveListing(listing.id)"
      :disabled="actionLoading === listing.id"
      class="flex items-center justify-center gap-1 bg-green-50 hover:bg-green-100 text-green-600 text-sm px-4 py-2 rounded-lg transition font-semibold disabled:opacity-50">
      {{ actionLoading === listing.id ? '...' : '✅ Approve' }}
    </button>
  </template>

  <template v-else-if="listing.status === 'active'">
    <button @click="openRejectModal(listing)"
      :disabled="actionLoading === listing.id"
      class="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-500 text-sm px-4 py-2 rounded-lg transition font-semibold disabled:opacity-50">
      ❌ Reject
    </button>
  </template>

  <!-- Delete button — shown for all statuses -->
  <button @click="deleteListing(listing.id)"
    :disabled="actionLoading === listing.id"
    class="flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg transition font-semibold disabled:opacity-50">
    🗑️ Delete
  </button>

</div>
          </div>
        </div>
      </div>

    </div>

    <!-- Reject Modal -->
    <div v-if="rejectModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
      @click.self="rejectModal = false">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="font-bold text-gray-800 text-lg mb-1">Reject Listing</h3>
        <p class="text-sm text-gray-500 mb-4">
          Rejecting: <span class="font-semibold text-gray-700">{{ rejectTarget?.title }}</span>
        </p>

        <!-- Show review reason in reject modal too -->
        <div v-if="rejectTarget?.review_reason"
          class="mb-4 px-3 py-2 rounded-lg text-xs font-semibold"
          :class="reviewReasonLabel(rejectTarget.review_reason).class">
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
          <button @click="confirmReject"
            :disabled="actionLoading !== null"
            class="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition text-sm disabled:opacity-50">
            {{ actionLoading !== null ? 'Rejecting...' : 'Confirm Reject' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>