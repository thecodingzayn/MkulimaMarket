<script setup>
import { Icon } from '@iconify/vue'

definePageMeta({ middleware: ['auth', 'no-admin'] })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const loading = ref(true)
const notifications = ref([])
const page = ref(1)
const pageSize = 10
const hasMore = ref(false)
const clearingAll = ref(false)

const loadNotifications = async (reset = false) => {
  if (reset) {
    page.value = 1
    notifications.value = []
  }

  const from = (page.value - 1) * pageSize
  const to = from + pageSize

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .range(from, to) // fetch one extra to check if more exist

  if (data) {
    hasMore.value = data.length > pageSize
    const newItems = data.slice(0, pageSize)
    if (reset) {
      notifications.value = newItems
    } else {
      notifications.value = [...notifications.value, ...newItems]
    }
  }

  loading.value = false
}

const loadMore = async () => {
  page.value++
  await loadNotifications(false)
}

const refresh = () => loadNotifications(true)

const markAllRead = async () => {
  await supabase.from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)
  notifications.value = notifications.value.map(n => ({ ...n, read: true }))
}

const markRead = async (n) => {
  if (!n.read) {
    await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    const idx = notifications.value.findIndex(x => x.id === n.id)
    if (idx !== -1) notifications.value[idx] = { ...notifications.value[idx], read: true }
  }
  if (n.link) navigateTo(n.link)
}

const clearNotification = async (e, id) => {
  e.stopPropagation()
  await supabase.from('notifications').update({ deleted: true }).eq('id', id)
  notifications.value = notifications.value.filter(n => n.id !== id)
}

const clearAll = async () => {
  if (!confirm('Clear all notifications?')) return
  clearingAll.value = true
  await supabase.from('notifications')
    .update({ deleted: true })
    .eq('user_id', user.id)
  notifications.value = []
  hasMore.value = false
  clearingAll.value = false
}

const timeAgo = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(date).toLocaleDateString('en-KE')
}

const iconFor = (type) => {
  if (type === 'message') return 'mdi:message-outline'
  if (type === 'rating') return 'mdi:star-outline'
  if (type === 'listing_expiring') return 'mdi:clock-alert-outline'
  if (type === 'transport_request') return 'mdi:truck-outline'
  if (type === 'transport_application') return 'mdi:truck-check-outline'
  if (type === 'transport_status') return 'mdi:truck-delivery-outline'
  if (type === 'unavailable_report') return 'mdi:flag-outline'
  return 'mdi:bell-outline'
}

const colorFor = (type) => {
  if (type === 'message') return 'bg-blue-100 text-blue-600'
  if (type === 'rating') return 'bg-yellow-100 text-yellow-600'
  if (type === 'listing_expiring') return 'bg-orange-100 text-orange-600'
  if (type?.startsWith('transport')) return 'bg-purple-100 text-purple-600'
  if (type === 'unavailable_report') return 'bg-red-100 text-red-600'
  return 'bg-green-100 text-green-600'
}

onMounted(async () => {
  await loadNotifications(true)
  const interval = setInterval(refresh, 15000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<template>
  <ProfileLayout>
    <div class="bg-white rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b">
        <h1 class="text-lg sm:text-xl font-bold text-gray-800">
          Notifications
          <span v-if="!loading && notifications.some(n => !n.read)"
            class="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-normal">
            {{ notifications.filter(n => !n.read).length }} new
          </span>
        </h1>
        <div class="flex items-center gap-3">
          <button
            v-if="!loading && notifications.some(n => !n.read)"
            @click="markAllRead"
            class="text-xs sm:text-sm text-green-600 hover:underline font-medium">
            Mark all read
          </button>
          <button
            v-if="!loading && notifications.length > 0"
            @click="clearAll"
            :disabled="clearingAll"
            class="text-xs sm:text-sm text-red-500 hover:underline font-medium disabled:opacity-50">
            {{ clearingAll ? 'Clearing...' : 'Clear all' }}
          </button>
        </div>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="divide-y">
        <div v-for="n in 6" :key="n"
          class="flex gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 animate-pulse">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-200 shrink-0"></div>
          <div class="flex-1 space-y-2 py-1">
            <div class="h-4 bg-gray-200 rounded-full w-3/4"></div>
            <div class="h-3 bg-gray-200 rounded-full w-full"></div>
            <div class="h-3 bg-gray-200 rounded-full w-1/4"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="notifications.length === 0" class="py-16 sm:py-24 text-center px-4">
        <Icon icon="mdi:bell-outline" class="w-14 h-14 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500 font-semibold text-sm sm:text-base">No notifications yet</p>
        <p class="text-gray-400 text-xs sm:text-sm mt-1">
          We'll notify you about messages and activity
        </p>
      </div>

      <!-- Notifications list -->
      <div v-else class="divide-y">
        <div
          v-for="n in notifications"
          :key="n.id"
          @click="markRead(n)"
          class="flex gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 cursor-pointer hover:bg-gray-50 transition group relative"
          :class="!n.read ? 'bg-green-50 hover:bg-green-100' : ''">

          <!-- Icon -->
          <div
            class="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0"
            :class="!n.read ? colorFor(n.type) : 'bg-gray-100 text-gray-500'">
            <Icon :icon="iconFor(n.type)" class="w-5 h-5" />
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0 pr-6">
            <p class="text-sm sm:text-base font-semibold text-gray-800">
              {{ n.title }}
            </p>
            <p v-if="n.body" class="text-xs sm:text-sm text-gray-500 mt-0.5 line-clamp-2">
              {{ n.body }}
            </p>
            <p class="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Icon icon="mdi:clock-outline" class="w-3 h-3" />
              {{ timeAgo(n.created_at) }}
            </p>
          </div>

          <!-- Right side: unread dot + clear button -->
          <div class="flex flex-col items-center gap-1 shrink-0">
            <div v-if="!n.read" class="w-2.5 h-2.5 rounded-full bg-green-500 mt-1"></div>
            <!-- Clear button — visible on hover -->
            <button
              @click="(e) => clearNotification(e, n.id)"
              class="opacity-0 group-hover:opacity-100 transition w-6 h-6 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-red-400 mt-auto">
              <Icon icon="mdi:close" class="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        <!-- Load more -->
        <div v-if="hasMore" class="px-6 py-4 text-center">
          <button @click="loadMore"
            class="text-sm text-green-600 hover:underline font-medium flex items-center gap-1 mx-auto">
            <Icon icon="mdi:chevron-down" class="w-4 h-4" />
            Load more notifications
          </button>
        </div>

        <!-- End of notifications -->
        <div v-else-if="notifications.length >= pageSize"
          class="px-6 py-3 text-center text-xs text-gray-400">
          You're all caught up!
        </div>

      </div>

    </div>
  </ProfileLayout>
</template>