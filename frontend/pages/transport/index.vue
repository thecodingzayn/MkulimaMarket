<script setup>
import { Icon } from '@iconify/vue'

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const { data: requests } = await useAsyncData('transport-requests', async () => {
  // Always fetch open requests
  const { data: openRequests, error } = await supabase
    .from('transport_requests')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) return []

  let assignedRequests = []

  if (user?.id) {
    // Fetch assigned requests owned by current user
    const { data: ownedAssigned } = await supabase
      .from('transport_requests')
      .select('*')
      .eq('status', 'assigned')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Fetch assigned requests where current user is the accepted transporter
    const { data: acceptedApps } = await supabase
      .from('transport_applications')
      .select('request_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted')

    if (acceptedApps?.length) {
      const requestIds = acceptedApps.map(a => a.request_id)
      const { data: transporterAssigned } = await supabase
        .from('transport_requests')
        .select('*')
        .eq('status', 'assigned')
        .in('id', requestIds)
        .order('created_at', { ascending: false })

      assignedRequests = [
        ...(ownedAssigned ?? []),
        ...(transporterAssigned ?? [])
      ]

      // Deduplicate in case user is both owner and transporter (shouldn't happen but safe)
      assignedRequests = assignedRequests.filter(
        (r, i, self) => self.findIndex(x => x.id === r.id) === i
      )
    } else {
      assignedRequests = ownedAssigned ?? []
    }
  }

  // Merge open + assigned, deduplicate
  const all = [...(openRequests ?? []), ...assignedRequests]
  const unique = all.filter((r, i, self) => self.findIndex(x => x.id === r.id) === i)

  if (!unique.length) return []

  // Fetch profiles for all requests
  const userIds = [...new Set(unique.map(r => r.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, location')
    .in('id', userIds)

  const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) ?? [])
  return unique.map(r => ({ ...r, profiles: profileMap[r.user_id] ?? null }))
})

const formatDate = (d) => new Date(d).toLocaleDateString('en-KE', {
  day: 'numeric', month: 'short', year: 'numeric'
})

onMounted(async () => {
  const { data: { user: u } } = await supabase.auth.getUser()
  if (!u?.id) return
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', u.id)
    .eq('read', false)
    .in('type', ['transport_request'])
})
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-4 md:py-8">
    <div class="max-w-4xl mx-auto px-3 md:px-4">

      <!-- Header -->
      <div class="flex justify-between items-center mb-4 md:mb-6">
        <h1 class="text-lg md:text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Icon icon="mdi:truck-outline" class="w-6 h-6 md:w-7 md:h-7 text-green-600" />
          Transport Requests
        </h1>
        <NuxtLink v-if="user" to="/transport/new"
          class="bg-green-600 hover:bg-green-700 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-xl font-semibold text-xs md:text-sm transition flex items-center gap-1">
          <Icon icon="mdi:plus" class="w-4 h-4" />
          Post a Request
        </NuxtLink>
      </div>

      <!-- Request cards -->
      <div v-if="requests.length" class="space-y-3 md:space-y-4">
        <div v-for="req in requests" :key="req.id"
          class="bg-white rounded-2xl shadow-sm p-4 md:p-5 hover:shadow-md transition">

          <div class="flex justify-between items-start flex-wrap gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <p class="font-bold text-gray-800 text-base md:text-lg truncate flex items-center gap-2">
                  <Icon icon="mdi:map-marker-path" class="w-5 h-5 text-green-500 shrink-0" />
                  {{ req.pickup_location }} → {{ req.destination }}
                </p>
                <!-- Status badge — only show assigned to relevant users -->
                <span v-if="req.status === 'assigned'"
                  class="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 flex items-center gap-1 shrink-0">
                  <Icon icon="mdi:truck-check" class="w-3 h-3" />
                  Assigned
                </span>
              </div>
              <p class="text-xs md:text-sm text-gray-500 flex items-center gap-2">
                <Icon icon="mdi:package-variant" class="w-4 h-4 shrink-0" />
                {{ req.cargo_type }} · {{ req.quantity }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p v-if="req.budget" class="font-bold text-green-600 text-base md:text-lg">
                KSh {{ Number(req.budget).toLocaleString('en-KE') }}
              </p>
              <p class="text-xs text-gray-400 flex items-center justify-end gap-1 mt-0.5">
                <Icon icon="mdi:calendar-outline" class="w-3.5 h-3.5" />
                {{ formatDate(req.preferred_date) }}
              </p>
            </div>
          </div>

          <div class="flex justify-between items-center mt-3 md:mt-4 pt-3 border-t border-gray-100 gap-2">
            <p class="text-xs text-gray-400 truncate flex-1 flex items-center gap-2">
              <Icon icon="mdi:account" class="w-3.5 h-3.5 shrink-0" />
              {{ req.profiles?.name }}
              <Icon icon="mdi:map-marker" class="w-3.5 h-3.5 shrink-0 ml-1" />
              {{ req.profiles?.location }}
            </p>
            <NuxtLink :to="`/transport/${req.id}`"
              class="text-xs md:text-sm font-semibold shrink-0 flex items-center gap-1 transition"
              :class="req.status === 'assigned' ? 'text-blue-600 hover:underline' : 'text-green-600 hover:underline'">
              {{ req.status === 'assigned' ? 'View Details' : 'View & Apply' }}
              <Icon icon="mdi:arrow-right" class="w-4 h-4" />
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-12 md:py-20">
        <Icon icon="mdi:truck-outline" class="w-16 h-16 md:w-20 md:h-20 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500 text-sm md:text-base">No open transport requests yet.</p>
        <NuxtLink v-if="user" to="/transport/new"
          class="mt-4 inline-block text-green-600 hover:underline text-sm">
          Be the first to post one →
        </NuxtLink>
      </div>

    </div>
  </div>
</template>