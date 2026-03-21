<script setup>
import { Icon } from '@iconify/vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()

const logout = async () => {
  await supabase.auth.signOut()
  navigateTo('/auth/login')
}

const unreadCount = ref(0)
const unreadNotifications = ref(0)
const unreadTransport = ref(0)

const fetchAll = async () => {
  const { data: { user: u } } = await supabase.auth.getUser()
  if (!u?.id) return

  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .or(`initiator_id.eq.${u.id},recipient_id.eq.${u.id}`)
    .eq('is_spam', false)

  if (convs?.length) {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('read', false)
      .neq('sender_id', u.id)
      .in('conversation_id', convs.map(c => c.id))
    unreadCount.value = count ?? 0
  } else {
    unreadCount.value = 0
  }

  const { count: nCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', u.id)
    .eq('read', false)
  unreadNotifications.value = nCount ?? 0

  const { count: tCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', u.id)
    .eq('read', false)
    .in('type', ['transport_request', 'transport_application', 'transport_status'])
  unreadTransport.value = tCount ?? 0
}

onMounted(async () => {
  await fetchAll()

  const { data: { user: u } } = await supabase.auth.getUser()
  if (!u?.id) return

  const channel = supabase
    .channel('navbar-counts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${u.id}` }, () => fetchAll())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${u.id}` }, () => fetchAll())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchAll())
    .subscribe()

  onUnmounted(() => supabase.removeChannel(channel))
})

const isActive = (path) => route.path.startsWith(path)
</script>

<template>
  <nav class="bg-green-600 text-white px-3 md:px-6 py-2 md:py-3 shadow-lg relative z-10">
    <div class="max-w-7xl mx-auto flex justify-between items-center">

      <!-- Logo -->
      <NuxtLink to="/" class="text-lg md:text-2xl font-bold tracking-wide shrink-0">
        MkulimaMarket
      </NuxtLink>

      <!-- Right Side -->
      <div class="flex items-center gap-1 md:gap-3">

        <!-- Logged out -->
        <template v-if="!user">
          <NuxtLink to="/auth/login"
            class="px-3 py-1.5 md:px-4 md:py-2 hover:bg-green-700 rounded-lg transition text-xs md:text-sm font-medium">
            Sign In
          </NuxtLink>
          <NuxtLink to="/auth/register"
            class="px-3 py-1.5 md:px-4 md:py-2 hover:bg-green-700 rounded-lg transition text-xs md:text-sm font-medium">
            Register
          </NuxtLink>
        </template>

        <!-- Logged in -->
        <template v-else>

          <!-- Transport -->
          <NuxtLink to="/transport"
            class="relative w-8 h-8 md:w-11 md:h-11 rounded-full flex items-center justify-center transition group/tip"
            :class="isActive('/transport') ? 'bg-white' : 'bg-white hover:bg-gray-100'">
            <Icon icon="mdi:truck-outline" class="w-4 h-4 md:w-7 md:h-7 transition"
              :class="isActive('/transport') ? 'text-green-600' : 'text-gray-600'" />
            <span v-if="unreadTransport > 0"
              class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center font-bold leading-none">
              {{ unreadTransport > 9 ? '9+' : unreadTransport }}
            </span>
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50 hidden md:block">
              Transport
            </span>
          </NuxtLink>

          <!-- Saved -->
          <NuxtLink to="/saved"
            class="relative w-8 h-8 md:w-11 md:h-11 rounded-full flex items-center justify-center transition group/tip"
            :class="isActive('/saved') ? 'bg-white' : 'bg-white hover:bg-gray-100'">
            <Icon icon="mdi:bookmark-outline" class="w-4 h-4 md:w-7 md:h-7 transition"
              :class="isActive('/saved') ? 'text-green-600' : 'text-gray-600'" />
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50 hidden md:block">
              Saved
            </span>
          </NuxtLink>

          <!-- Messages -->
          <NuxtLink to="/messages"
            class="relative w-8 h-8 md:w-11 md:h-11 rounded-full flex items-center justify-center transition group/tip"
            :class="isActive('/messages') ? 'bg-white' : 'bg-white hover:bg-gray-100'">
            <Icon icon="mdi:message-outline" class="w-4 h-4 md:w-7 md:h-7 transition"
              :class="isActive('/messages') ? 'text-green-600' : 'text-gray-600'" />
            <span v-if="unreadCount > 0"
              class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center font-bold leading-none">
              {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50 hidden md:block">
              My messages
            </span>
          </NuxtLink>

          <!-- Notifications -->
          <NuxtLink to="/notifications"
            class="relative w-8 h-8 md:w-11 md:h-11 rounded-full flex items-center justify-center transition group/tip"
            :class="isActive('/notifications') ? 'bg-white' : 'bg-white hover:bg-gray-100'">
            <Icon icon="mdi:bell-outline" class="w-4 h-4 md:w-7 md:h-7 transition"
              :class="isActive('/notifications') ? 'text-green-600' : 'text-gray-600'" />
            <span v-if="unreadNotifications > 0"
              class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center font-bold leading-none">
              {{ unreadNotifications > 9 ? '9+' : unreadNotifications }}
            </span>
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50 hidden md:block">
              Notifications
            </span>
          </NuxtLink>

          <!-- My Listings -->
          <NuxtLink to="/dashboard"
            class="relative w-8 h-8 md:w-11 md:h-11 rounded-full flex items-center justify-center transition group/tip hidden sm:flex"
            :class="isActive('/dashboard') ? 'bg-white' : 'bg-white hover:bg-gray-100'">
            <Icon icon="mdi:clipboard-list-outline" class="w-4 h-4 md:w-7 md:h-7 transition"
              :class="isActive('/dashboard') ? 'text-green-600' : 'text-gray-600'" />
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50 hidden md:block">
              My listings
            </span>
          </NuxtLink>

          <!-- Profile dropdown -->
          <div class="relative group">
            <button
              class="relative w-8 h-8 md:w-11 md:h-11 rounded-full flex items-center justify-center transition group/tip"
              :class="isActive('/profile') ? 'bg-white' : 'bg-white hover:bg-gray-100'">
              <Icon icon="mdi:account-outline" class="w-4 h-4 md:w-7 md:h-7 transition"
                :class="isActive('/profile') ? 'text-green-600' : 'text-gray-600'" />
              <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50 hidden md:block">
                Profile
              </span>
            </button>

            <!-- Invisible bridge -->
            <div class="absolute top-8 md:top-10 -right-14 w-48 h-4 hidden group-hover:block"></div>

            <div
              class="absolute -right-14 top-10 md:top-12 bg-white text-gray-700 shadow-lg overflow-hidden hidden group-hover:block z-50 border border-gray-100"
              style="min-width: max-content;">

              <NuxtLink to="/dashboard"
                class="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-sm text-gray-700 transition border-b border-gray-100">
                <Icon icon="mdi:clipboard-list-outline" class="w-4 h-4 text-gray-400 shrink-0" />
                My Listings
              </NuxtLink>

              <NuxtLink to="/saved"
                class="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-sm text-gray-700 transition border-b border-gray-100">
                <Icon icon="mdi:bookmark-outline" class="w-4 h-4 text-gray-400 shrink-0" />
                Saved Listings
              </NuxtLink>

              <NuxtLink to="/profile/edit"
                class="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-sm text-gray-700 transition border-b border-gray-100">
                <Icon icon="mdi:cog-outline" class="w-4 h-4 text-gray-400 shrink-0" />
                Settings
              </NuxtLink>

              <button @click="logout"
                class="w-full flex items-center gap-3 px-5 py-3 hover:bg-red-50 text-sm text-red-500 transition">
                <Icon icon="mdi:logout" class="w-4 h-4 shrink-0" />
                Log out
              </button>

            </div>
          </div>

        </template>

        <!-- Sell Button -->
        <NuxtLink to="/listings/new"
          class="bg-orange-400 hover:bg-orange-600 px-3 md:px-6 py-1.5 md:py-2.5 rounded-xl font-bold transition text-xs md:text-sm ml-1 md:ml-2 shrink-0">
          Sell
        </NuxtLink>

      </div>
    </div>
  </nav>
</template>