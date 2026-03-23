<script setup>
import { Icon } from '@iconify/vue'

const supabase = useSupabaseClient()
const route = useRoute()
const { data: { user } } = await supabase.auth.getUser()

const { data: request, refresh: refreshRequest } = await useAsyncData('transport-request', async () => {
  const { data } = await supabase
    .from('transport_requests')
    .select('*')
    .eq('id', route.params.id)
    .single()

  if (!data) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, phone, location')
    .eq('id', data.user_id)
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

  const userIds = [...new Set(data.map(a => a.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .in('id', userIds)

  const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) ?? [])
  return data.map(a => ({ ...a, profiles: profileMap[a.user_id] ?? null }))
})

const isOwner = computed(() => user?.id === request.value?.user_id)
const isAssigned = computed(() => request.value?.status === 'assigned')

// The current user's own application
const myApplication = computed(() =>
  applications.value?.find(a => a.user_id === user?.id) ?? null
)

const hasApplied = computed(() => !!myApplication.value)
const isAcceptedTransporter = computed(() => myApplication.value?.status === 'accepted')

// The accepted application
const acceptedApplication = computed(() =>
  applications.value?.find(a => a.status === 'accepted') ?? null
)

// Owner sees all applications when open, only accepted when assigned
// Non-owners never see the applications list
const visibleApplications = computed(() => {
  if (!isOwner.value || !applications.value?.length) return []
  if (isAssigned.value) return applications.value.filter(a => a.status === 'accepted')
  return applications.value
})

const appForm = ref({ message: '', price_offer: '' })
const appLoading = ref(false)
const appError = ref('')
const appSuccess = ref(false)

const applyNow = async () => {
  appLoading.value = true
  appError.value = ''
  const { error } = await supabase.from('transport_applications').insert({
    request_id: Number(route.params.id),
    user_id: user.id,
    message: appForm.value.message || null,
    price_offer: appForm.value.price_offer ? Number(appForm.value.price_offer) : null
  })
  appLoading.value = false
  if (error) {
    appError.value = error.code === '23505' ? 'You already applied.' : error.message
    return
  }
  appSuccess.value = true
  await refreshApps()
}

const updateApplication = async (appId, status) => {
  await supabase.from('transport_applications').update({ status }).eq('id', appId)
  if (status === 'accepted') {
    await supabase.from('transport_requests').update({ status: 'assigned' }).eq('id', route.params.id)
    // Auto-reject all other pending applications
    await supabase
      .from('transport_applications')
      .update({ status: 'rejected' })
      .eq('request_id', route.params.id)
      .eq('status', 'pending')
      .neq('id', appId)
  }
  await refreshApps()
  await refreshRequest()
}

const formatDate = (d) => new Date(d).toLocaleDateString('en-KE', {
  day: 'numeric', month: 'long', year: 'numeric'
})

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
  <div class="bg-gray-100 min-h-screen py-4 md:py-8">
    <div class="max-w-3xl mx-auto px-3 md:px-4">

      <button @click="$router.back()"
        class="text-gray-500 hover:text-green-600 mb-4 md:mb-6 flex items-center gap-2 transition text-sm md:text-base">
        <Icon icon="mdi:arrow-left" class="w-5 h-5" />
        Back to requests
      </button>

      <div v-if="request" class="space-y-3 md:space-y-4">

        <!-- Request details card -->
        <div class="bg-white rounded-2xl shadow-sm p-4 md:p-6">
          <div class="flex justify-between items-start flex-wrap gap-2 mb-4">
            <h1 class="text-base md:text-xl font-bold text-gray-800 flex-1 min-w-0 pr-2 flex items-center gap-2">
              <Icon icon="mdi:map-marker-path" class="w-5 h-5 text-green-500 shrink-0" />
              {{ request.pickup_location }} → {{ request.destination }}
            </h1>
            <span class="text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-semibold shrink-0 flex items-center gap-1"
              :class="request.status === 'open' ? 'bg-green-100 text-green-700'
                : request.status === 'assigned' ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500'">
              <Icon
                :icon="request.status === 'open' ? 'mdi:check-circle' : request.status === 'assigned' ? 'mdi:truck-check' : 'mdi:clock-outline'"
                class="w-3.5 h-3.5" />
              {{ request.status === 'assigned' ? 'Assigned' : request.status }}
            </span>
          </div>

          <!-- Info grid -->
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 text-sm">
            <div class="bg-gray-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:package-variant" class="w-3.5 h-3.5" />
                Cargo
              </p>
              <p class="font-semibold text-gray-700 text-xs md:text-sm">{{ request.cargo_type }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:weight" class="w-3.5 h-3.5" />
                Quantity
              </p>
              <p class="font-semibold text-gray-700 text-xs md:text-sm">{{ request.quantity }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:calendar-outline" class="w-3.5 h-3.5" />
                Date
              </p>
              <p class="font-semibold text-gray-700 text-xs md:text-sm">{{ formatDate(request.preferred_date) }}</p>
            </div>
            <div v-if="request.preferred_time" class="bg-gray-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:clock-outline" class="w-3.5 h-3.5" />
                Time
              </p>
              <p class="font-semibold text-gray-700 text-xs md:text-sm">{{ request.preferred_time }}</p>
            </div>
            <div v-if="request.budget" class="bg-green-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:cash" class="w-3.5 h-3.5" />
                Budget
              </p>
              <p class="font-semibold text-green-700 text-xs md:text-sm">
                KSh {{ Number(request.budget).toLocaleString('en-KE') }}
              </p>
            </div>
            <div class="bg-gray-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:phone-outline" class="w-3.5 h-3.5" />
                Contact
              </p>
              <a :href="`tel:${request.contact_phone}`"
                class="font-semibold text-blue-600 text-xs md:text-sm">
                {{ request.contact_phone }}
              </a>
            </div>
          </div>

          <!-- Requester info -->
          <div class="border-t mt-3 md:mt-4 pt-3 md:pt-4 flex items-center gap-3">
            <div class="w-8 h-8 md:w-9 md:h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Icon icon="mdi:account" class="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p class="font-semibold text-gray-700 text-sm">{{ request.profiles?.name }}</p>
              <p class="text-xs text-gray-400 flex items-center gap-1">
                <Icon icon="mdi:map-marker" class="w-3.5 h-3.5" />
                {{ request.profiles?.location }}
              </p>
            </div>
          </div>
        </div>

        <!-- ─────────────────────────────────────────────────────── -->
        <!-- ACCEPTED OFFER CARD — visible to owner + accepted transporter only -->
        <!-- ─────────────────────────────────────────────────────── -->
        <div v-if="isAssigned && (isOwner || isAcceptedTransporter) && acceptedApplication"
          class="bg-white rounded-2xl shadow-sm p-4 md:p-6 border border-blue-100">

          <h2 class="font-bold text-gray-800 mb-4 text-base md:text-lg flex items-center gap-2">
            <Icon icon="mdi:truck-check" class="w-5 h-5 text-blue-600" />
            Accepted Offer
          </h2>

          <!-- Offer details grid -->
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 mb-4">
            <div class="bg-gray-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:map-marker-path" class="w-3.5 h-3.5" />
                Route
              </p>
              <p class="font-semibold text-gray-700 text-xs md:text-sm">
                {{ request.pickup_location }} → {{ request.destination }}
              </p>
            </div>
            <div class="bg-gray-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:package-variant" class="w-3.5 h-3.5" />
                Cargo
              </p>
              <p class="font-semibold text-gray-700 text-xs md:text-sm">{{ request.cargo_type }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:calendar-outline" class="w-3.5 h-3.5" />
                Date
              </p>
              <p class="font-semibold text-gray-700 text-xs md:text-sm">{{ formatDate(request.preferred_date) }}</p>
            </div>
            <div v-if="request.preferred_time" class="bg-gray-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:clock-outline" class="w-3.5 h-3.5" />
                Time
              </p>
              <p class="font-semibold text-gray-700 text-xs md:text-sm">{{ request.preferred_time }}</p>
            </div>
            <div v-if="request.quantity" class="bg-gray-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:weight" class="w-3.5 h-3.5" />
                Quantity
              </p>
              <p class="font-semibold text-gray-700 text-xs md:text-sm">{{ request.quantity }}</p>
            </div>
            <div v-if="acceptedApplication.price_offer" class="bg-green-50 rounded-xl p-2.5 md:p-3">
              <p class="text-gray-400 text-xs mb-1 flex items-center gap-1">
                <Icon icon="mdi:cash" class="w-3.5 h-3.5" />
                Agreed price
              </p>
              <p class="font-bold text-green-700 text-xs md:text-sm">
                KSh {{ Number(acceptedApplication.price_offer).toLocaleString('en-KE') }}
              </p>
            </div>
          </div>

          <!-- Message from transporter -->
          <div v-if="acceptedApplication.message"
            class="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm text-gray-600 italic border-l-4 border-blue-300">
            "{{ acceptedApplication.message }}"
          </div>

          <!-- Contact row — owner sees transporter, transporter sees owner -->
          <div class="border-t pt-4 space-y-3">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</p>

            <!-- Owner sees the accepted transporter -->
            <div v-if="isOwner" class="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
              <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Icon icon="mdi:truck-outline" class="w-5 h-5 text-blue-600" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 text-sm">{{ acceptedApplication.profiles?.name }}</p>
                <p class="text-xs text-gray-400">Transporter</p>
              </div>
              <a :href="`tel:${acceptedApplication.profiles?.phone}`"
                class="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shrink-0">
                <Icon icon="mdi:phone" class="w-3.5 h-3.5" />
                {{ acceptedApplication.profiles?.phone }}
              </a>
            </div>

            <!-- Accepted transporter sees the owner -->
            <div v-if="isAcceptedTransporter" class="flex items-center gap-3 bg-green-50 rounded-xl p-3">
              <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Icon icon="mdi:account" class="w-5 h-5 text-green-600" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 text-sm">{{ request.profiles?.name }}</p>
                <p class="text-xs text-gray-400">Requester</p>
              </div>
              <a :href="`tel:${request.contact_phone}`"
                class="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shrink-0">
                <Icon icon="mdi:phone" class="w-3.5 h-3.5" />
                {{ request.contact_phone }}
              </a>
            </div>
          </div>
        </div>

        <!-- ─────────────────────────────────────────────────────── -->
        <!-- OTHER USERS — request assigned but they are not involved -->
        <!-- ─────────────────────────────────────────────────────── -->
        <div v-if="isAssigned && !isOwner && !isAcceptedTransporter && user"
          class="bg-white rounded-2xl shadow-sm p-4 md:p-6 text-center">
          <Icon icon="mdi:truck-check" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p class="font-semibold text-gray-700 text-sm">This request has been assigned</p>
          <p class="text-gray-400 text-xs mt-1 mb-4">A transporter has already been selected for this job.</p>
          <NuxtLink to="/transport"
            class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold transition text-sm">
            <Icon icon="mdi:arrow-left" class="w-4 h-4" />
            Browse other requests
          </NuxtLink>
        </div>

        <!-- ─────────────────────────────────────────────────────── -->
        <!-- APPLY SECTION — only shown when request is open -->
        <!-- ─────────────────────────────────────────────────────── -->
        <template v-if="!isOwner && user && !isAssigned">

          <!-- Already applied -->
          <div v-if="hasApplied && !appSuccess"
            class="bg-blue-50 text-blue-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <Icon icon="mdi:check-circle" class="w-5 h-5 shrink-0" />
            You have already applied for this request. The requester will contact you if selected.
          </div>

          <!-- Apply form -->
          <div v-if="!hasApplied && !appSuccess"
            class="bg-white rounded-2xl shadow-sm p-4 md:p-6">
            <h2 class="font-bold text-gray-800 mb-3 md:mb-4 text-base md:text-lg flex items-center gap-2">
              <Icon icon="mdi:truck-outline" class="w-5 h-5 text-green-600" />
              Apply for this job
            </h2>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Your price offer (KSh)</label>
                <input v-model="appForm.price_offer" type="number" placeholder="e.g. 4500"
                  class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Message <span class="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea v-model="appForm.message" rows="3"
                  placeholder="Describe your vehicle, capacity, experience..."
                  class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <p v-if="appError" class="text-red-500 text-sm">{{ appError }}</p>
              <button @click="applyNow" :disabled="appLoading"
                class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-semibold transition text-sm flex items-center justify-center gap-2">
                <Icon icon="mdi:truck-outline" class="w-4 h-4" />
                {{ appLoading ? 'Submitting...' : 'Submit Application' }}
              </button>
            </div>
          </div>

          <!-- Success after submitting -->
          <div v-if="appSuccess"
            class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <Icon icon="mdi:check-circle" class="w-5 h-5 shrink-0" />
            Application submitted! {{ request.profiles?.name ?? 'The requester' }} will contact you if selected.
          </div>

        </template>

        <!-- Not logged in -->
        <div v-if="!user && request.status === 'open'"
          class="bg-white rounded-2xl shadow-sm p-4 md:p-6 text-center">
          <Icon icon="mdi:truck-outline" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p class="text-gray-500 text-sm mb-3">Sign in to apply for this transport request</p>
          <NuxtLink to="/auth/login"
            class="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-semibold transition text-sm">
            <Icon icon="mdi:login" class="w-4 h-4" />
            Sign In
          </NuxtLink>
        </div>

        <!-- ─────────────────────────────────────────────────────── -->
        <!-- OWNER — applications list (only shown when request is open) -->
        <!-- ─────────────────────────────────────────────────────── -->
        <template v-if="isOwner && !isAssigned">

          <div v-if="visibleApplications.length > 0"
            class="bg-white rounded-2xl shadow-sm p-4 md:p-6">
            <h2 class="font-bold text-gray-800 mb-3 md:mb-4 text-base md:text-lg flex items-center gap-2">
              <Icon icon="mdi:account-group" class="w-5 h-5 text-green-600" />
              Applications
              <span class="text-sm font-normal text-gray-400">({{ visibleApplications.length }})</span>
            </h2>
            <div class="space-y-3">
              <div v-for="app in visibleApplications" :key="app.id"
                class="border border-gray-100 rounded-xl p-3 md:p-4">

                <div class="flex justify-between items-start flex-wrap gap-2">
                  <div class="flex items-center gap-2 md:gap-3">
                    <div class="w-8 h-8 md:w-9 md:h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Icon icon="mdi:truck-outline" class="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p class="font-semibold text-gray-700 text-sm">{{ app.profiles?.name }}</p>
                      <p class="text-xs text-gray-400 flex items-center gap-1">
                        <Icon icon="mdi:phone-outline" class="w-3 h-3" />
                        {{ app.profiles?.phone }}
                      </p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p v-if="app.price_offer" class="font-bold text-green-600 text-sm md:text-base">
                      KSh {{ Number(app.price_offer).toLocaleString('en-KE') }}
                    </p>
                    <span class="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 justify-end mt-1"
                      :class="app.status === 'accepted' ? 'bg-green-100 text-green-700'
                        : app.status === 'rejected' ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-500'">
                      <Icon
                        :icon="app.status === 'accepted' ? 'mdi:check-circle' : app.status === 'rejected' ? 'mdi:close-circle' : 'mdi:clock-outline'"
                        class="w-3 h-3" />
                      {{ app.status }}
                    </span>
                  </div>
                </div>

                <p v-if="app.message" class="text-sm text-gray-500 mt-2 ml-10 md:ml-12 italic">
                  "{{ app.message }}"
                </p>

                <div v-if="app.status === 'pending'"
                  class="flex gap-2 mt-3 ml-10 md:ml-12">
                  <button @click="updateApplication(app.id, 'accepted')"
                    class="flex items-center gap-1 px-3 md:px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs md:text-sm rounded-lg font-semibold transition">
                    <Icon icon="mdi:check" class="w-4 h-4" />
                    Accept
                  </button>
                  <button @click="updateApplication(app.id, 'rejected')"
                    class="flex items-center gap-1 px-3 md:px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 text-xs md:text-sm rounded-lg font-semibold transition">
                    <Icon icon="mdi:close" class="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- No applications yet -->
          <div v-else class="bg-white rounded-2xl shadow-sm p-6 text-center">
            <Icon icon="mdi:account-search" class="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p class="text-gray-400 text-sm">No applications yet.</p>
            <p class="text-gray-400 text-xs mt-1">Share this page to get transporters to apply.</p>
          </div>

        </template>

      </div>

      <!-- Request not found -->
      <div v-else class="text-center py-20">
        <Icon icon="mdi:truck-outline" class="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500">Transport request not found.</p>
        <NuxtLink to="/transport" class="mt-4 inline-block text-green-600 hover:underline text-sm">
          Back to requests
        </NuxtLink>
      </div>

    </div>
  </div>
</template>