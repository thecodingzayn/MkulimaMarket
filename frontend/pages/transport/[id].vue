<script setup>
const supabase = useSupabaseClient()
const route = useRoute()
const { data: { user } } = await supabase.auth.getUser()

const { data: request } = await useAsyncData('transport-request', async () => {
  const { data } = await supabase
    .from('transport_requests')
    .select('*')
    .eq('id', route.params.id)
    .single()

  if (!data) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, phone, location')
    .eq('id', data.user_id)  // ← was farmer_id
    .single()

  return { ...data, profiles: profile ?? null }
})

const { data: applications, refresh: refreshApps } = await useAsyncData('applications', async () => {
  if (!request.value) return []
  const { data } = await supabase
    .from('transport_applications')
    .select('*')
    .eq('request_id', route.params.id)
    .order('created_at', { ascending: false })

  if (!data?.length) return []

  const userIds = [...new Set(data.map(a => a.user_id))]  // ← was transporter_id
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .in('id', userIds)

  const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) ?? [])
  return data.map(a => ({ ...a, profiles: profileMap[a.user_id] ?? null }))  // ← was transporter_id
})

const isOwner = computed(() => user?.id === request.value?.user_id)  // ← was farmer_id
const hasApplied = computed(() => applications.value?.some(a => a.user_id === user?.id))  // ← was transporter_id

const appForm = ref({ message: '', price_offer: '' })
const appLoading = ref(false)
const appError = ref('')
const appSuccess = ref(false)

const applyNow = async () => {
  appLoading.value = true
  appError.value = ''
  const { error } = await supabase.from('transport_applications').insert({
    request_id: Number(route.params.id),
    user_id : user.id,
    message: appForm.value.message || null,
    price_offer: appForm.value.price_offer ? Number(appForm.value.price_offer) : null
  })
  appLoading.value = false
  if (error) { appError.value = error.code === '23505' ? 'You already applied.' : error.message; return }
  appSuccess.value = true
  await refreshApps()
}

const updateApplication = async (appId, status) => {
  await supabase.from('transport_applications').update({ status }).eq('id', appId)
  if (status === 'accepted') {
    await supabase.from('transport_requests').update({ status: 'assigned' }).eq('id', route.params.id)
  }
  await refreshApps()
}

const formatDate = (d) => new Date(d).toLocaleDateString('en-KE', {
  day: 'numeric', month: 'long', year: 'numeric'
})

// Mark transport notifications as read for this specific request
onMounted(async () => {
  const { data: { user: u } } = await supabase.auth.getUser()
  if (!u?.id) return

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', u.id)
    .eq('read', false)
    .eq('link', `/transport/${route.params.id}`)
    .in('type', ['transport_application', 'transport_status'])
})
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-3xl mx-auto px-4">
      <button @click="$router.back()"
        class="text-gray-500 hover:text-green-600 mb-6 flex items-center gap-2 transition">
        ← Back to requests
      </button>

      <div v-if="request" class="space-y-4">
        <!-- Request details -->
        <div class="bg-white rounded-2xl shadow-sm p-6">
          <div class="flex justify-between items-start flex-wrap gap-2 mb-4">
            <h1 class="text-xl font-bold text-gray-800">
              {{ request.pickup_location }} → {{ request.destination }}
            </h1>
            <span class="text-sm px-3 py-1 rounded-full font-semibold"
              :class="request.status === 'open' ? 'bg-green-100 text-green-700'
                : request.status === 'assigned' ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500'">
              {{ request.status }}
            </span>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-gray-400 text-xs mb-1">Cargo</p>
              <p class="font-semibold text-gray-700">{{ request.cargo_type }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-gray-400 text-xs mb-1">Quantity</p>
              <p class="font-semibold text-gray-700">{{ request.quantity }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-gray-400 text-xs mb-1">Date</p>
              <p class="font-semibold text-gray-700">{{ formatDate(request.preferred_date) }}</p>
            </div>
            <div v-if="request.preferred_time" class="bg-gray-50 rounded-xl p-3">
              <p class="text-gray-400 text-xs mb-1">Time</p>
              <p class="font-semibold text-gray-700">{{ request.preferred_time }}</p>
            </div>
            <div v-if="request.budget" class="bg-green-50 rounded-xl p-3">
              <p class="text-gray-400 text-xs mb-1">Budget</p>
              <p class="font-semibold text-green-700">KSh {{ Number(request.budget).toLocaleString('en-KE') }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-gray-400 text-xs mb-1">Contact</p>
              <a :href="`tel:${request.contact_phone}`"
                class="font-semibold text-blue-600">{{ request.contact_phone }}</a>
            </div>
          </div>

          <div class="border-t mt-4 pt-4 flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">👤</div>
            <div>
              <p class="font-semibold text-gray-700 text-sm">{{ request.profiles?.name }}</p>
              <p class="text-xs text-gray-400">📍 {{ request.profiles?.location }}</p>
            </div>
          </div>
        </div>

        <!-- Apply form (non-owner, not yet applied) -->
        <div v-if="!isOwner && user && !hasApplied && request.status === 'open'"
          class="bg-white rounded-2xl shadow-sm p-6">
          <h2 class="font-bold text-gray-800 mb-4">Apply for this job</h2>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Your price offer (KSh)</label>
              <input v-model="appForm.price_offer" type="number" placeholder="e.g. 4500"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Message <span class="text-gray-400">(optional)</span></label>
              <textarea v-model="appForm.message" rows="3"
                placeholder="Describe your vehicle, capacity, experience..."
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            <p v-if="appError" class="text-red-500 text-sm">{{ appError }}</p>
            <button @click="applyNow" :disabled="appLoading"
              class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-semibold transition text-sm">
              {{ appLoading ? 'Submitting...' : '🚛 Submit Application' }}
            </button>
          </div>
        </div>

        <div v-if="appSuccess"
  class="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-medium">
  ✅ Application submitted! {{ request.profiles?.name ?? 'The requester' }} will contact you if selected.
</div>

        <!-- Applications list (owner only) -->
        <div v-if="isOwner && applications.length > 0" class="bg-white rounded-2xl shadow-sm p-6">
          <h2 class="font-bold text-gray-800 mb-4">
            Applications
            <span class="text-sm font-normal text-gray-400 ml-1">({{ applications.length }})</span>
          </h2>
          <div class="space-y-3">
            <div v-for="app in applications" :key="app.id"
              class="border border-gray-100 rounded-xl p-4">
              <div class="flex justify-between items-start flex-wrap gap-2">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">🚛</div>
                  <div>
                    <p class="font-semibold text-gray-700 text-sm">{{ app.profiles?.name }}</p>
                    <p class="text-xs text-gray-400">{{ app.profiles?.phone }}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p v-if="app.price_offer" class="font-bold text-green-600">
                    KSh {{ Number(app.price_offer).toLocaleString('en-KE') }}
                  </p>
                  <span class="text-xs px-2 py-0.5 rounded-full"
                    :class="app.status === 'accepted' ? 'bg-green-100 text-green-700'
                      : app.status === 'rejected' ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-500'">
                    {{ app.status }}
                  </span>
                </div>
              </div>
              <p v-if="app.message" class="text-sm text-gray-500 mt-2 ml-12">{{ app.message }}</p>
              <div v-if="app.status === 'pending' && request.status === 'open'"
                class="flex gap-2 mt-3 ml-12">
                <button @click="updateApplication(app.id, 'accepted')"
                  class="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-semibold transition">
                  ✓ Accept
                </button>
                <button @click="updateApplication(app.id, 'rejected')"
                  class="px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 text-sm rounded-lg font-semibold transition">
                  ✕ Reject
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="isOwner && applications.length === 0"
          class="bg-white rounded-2xl shadow-sm p-6 text-center text-sm text-gray-400">
          No applications yet. Share this page to get others to apply!
        </div>
      </div>
    </div>
  </div>
</template>