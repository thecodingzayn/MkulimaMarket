<script setup>
definePageMeta({ middleware: ['auth', 'no-admin'] })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const { data: notifications, refresh } = await useAsyncData('notifications', async () => {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return data ?? []
})

const markAllRead = async () => {
  await supabase.from('notifications').update({ read: true })
    .eq('user_id', user.id).eq('read', false)
  await refresh()
}

const markRead = async (n) => {
  if (!n.read) {
    await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    n.read = true
  }
  if (n.link) navigateTo(n.link)
}

const timeAgo = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(date).toLocaleDateString('en-KE')
}

const iconFor = (type) => {
  if (type === 'message') return '💬'
  if (type === 'rating') return '⭐'
  if (type === 'listing_expiring') return '⏰'
  return '🔔'
}

onMounted(() => {
  const interval = setInterval(refresh, 15000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<template>
  <ProfileLayout>
    <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div class="flex items-center justify-between px-6 py-5 border-b">
        <h1 class="text-xl font-bold text-gray-800">Notifications</h1>
        <button v-if="notifications.some(n => !n.read)" @click="markAllRead"
          class="text-sm text-green-600 hover:underline font-medium">
          Mark all as read
        </button>
      </div>

      <div v-if="notifications.length === 0" class="py-24 text-center">
        <div class="text-5xl mb-4">🔔</div>
        <p class="text-gray-500 font-semibold">No notifications yet</p>
        <p class="text-gray-400 text-sm mt-1">We'll notify you about messages and activity</p>
      </div>

      <div v-else class="divide-y">
        <div v-for="n in notifications" :key="n.id" @click="markRead(n)"
          class="flex gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50 transition"
          :class="!n.read ? 'bg-green-50' : ''">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
            :class="!n.read ? 'bg-green-100' : 'bg-gray-100'">
            {{ iconFor(n.type) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-800">{{ n.title }}</p>
            <p v-if="n.body" class="text-sm text-gray-500 mt-0.5 truncate">{{ n.body }}</p>
            <p class="text-xs text-gray-400 mt-1">{{ timeAgo(n.created_at) }}</p>
          </div>
          <div v-if="!n.read" class="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-2"></div>
        </div>
      </div>
    </div>
  </ProfileLayout>
</template>