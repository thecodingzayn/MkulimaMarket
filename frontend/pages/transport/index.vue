<script setup>
const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const { data: requests } = await useAsyncData('transport-requests', async () => {
  const { data, error } = await supabase
    .from('transport_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data?.length) return []

  const userIds = [...new Set(data.map(r => r.user_id))]  // ← fixed
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, location')
    .in('id', userIds)

  const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) ?? [])
  return data.map(r => ({ ...r, profiles: profileMap[r.user_id] ?? null }))  // ← fixed
})


const formatDate = (d) => new Date(d).toLocaleDateString('en-KE', {
  day: 'numeric', month: 'short', year: 'numeric'
})

// Mark transport notifications as read
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
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-4xl mx-auto px-4">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">🚛 Transport Requests</h1>
        <NuxtLink v-if="user" to="/transport/new"
          class="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition">
          + Post a Request
        </NuxtLink>
      </div>

      <div v-if="requests.length" class="space-y-4">
        <div v-for="req in requests" :key="req.id"
          class="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition">
          <div class="flex justify-between items-start flex-wrap gap-2">
            <div>
              <p class="font-bold text-gray-800 text-lg">
                {{ req.pickup_location }} → {{ req.destination }}
              </p>
              <p class="text-sm text-gray-500 mt-0.5">
                📦 {{ req.cargo_type }} · {{ req.quantity }}
              </p>
            </div>
            <div class="text-right">
              <p v-if="req.budget" class="font-bold text-green-600 text-lg">
                KSh {{ Number(req.budget).toLocaleString('en-KE') }}
              </p>
              <p class="text-xs text-gray-400">📅 {{ formatDate(req.preferred_date) }}</p>
            </div>
          </div>

          <div class="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
            <p class="text-xs text-gray-400">
              👤 {{ req.profiles?.name }} · 📍 {{ req.profiles?.location }}
            </p>
            <NuxtLink :to="`/transport/${req.id}`"
              class="text-sm font-semibold text-green-600 hover:underline">
              View & Apply →
            </NuxtLink>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-20">
        <p class="text-5xl mb-4">🚛</p>
        <p class="text-gray-500">No open transport requests yet.</p>
        <NuxtLink v-if="user" to="/transport/new"
          class="mt-4 inline-block text-green-600 hover:underline text-sm">
          Be the first to post one →
        </NuxtLink>
      </div>
    </div>
  </div>
</template>