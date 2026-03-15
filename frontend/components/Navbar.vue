<script setup>
const supabase = useSupabaseClient()
const user = useSupabaseUser()

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
</script>

<template>
  <nav class="bg-green-600 text-white px-6 py-3 shadow-lg relative z-10">
    <div class="max-w-7xl mx-auto flex justify-between items-center">

      <!-- Logo -->
      <NuxtLink to="/" class="text-2xl font-bold tracking-wide">
        MkulimaMarket
      </NuxtLink>

      <!-- Right Side -->
      <div class="flex items-center gap-1.5">

        <!-- Logged out -->
        <template v-if="!user">
          <NuxtLink to="/auth/login"
            class="px-4 py-2 hover:bg-green-700 rounded-lg transition text-sm font-medium">
            Sign In
          </NuxtLink>
          <NuxtLink to="/auth/register"
            class="px-4 py-2 hover:bg-green-700 rounded-lg transition text-sm font-medium">
            Register
          </NuxtLink>
        </template>

        <!-- Logged in -->
        <template v-else>

          <!-- Transport -->
          <NuxtLink to="/transport"
            class="relative w-11 h-11 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition text-lg group/tip">
            🚛
            <span v-if="unreadTransport > 0"
              class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold leading-none">
              {{ unreadTransport > 9 ? '9+' : unreadTransport }}
            </span>
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50">
              Transport
            </span>
          </NuxtLink>

          <!-- Saved -->
          <NuxtLink to="/saved"
            class="relative w-11 h-11 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition text-lg group/tip">
            🔖
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50">
              Saved
            </span>
          </NuxtLink>

          <!-- Messages -->
          <NuxtLink to="/messages"
            class="relative w-11 h-11 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition text-lg group/tip">
            💬
            <span v-if="unreadCount > 0"
              class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold leading-none">
              {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50">
              My messages
            </span>
          </NuxtLink>

          <!-- Notifications -->
          <NuxtLink to="/notifications"
            class="relative w-11 h-11 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition text-lg group/tip">
            🔔
            <span v-if="unreadNotifications > 0"
              class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold leading-none">
              {{ unreadNotifications > 9 ? '9+' : unreadNotifications }}
            </span>
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50">
              Notifications
            </span>
          </NuxtLink>

          <!-- My Listings -->
          <NuxtLink to="/dashboard"
            class="relative w-11 h-11 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition text-lg group/tip">
            📋
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50">
              My listings
            </span>
          </NuxtLink>

        <!-- Profile dropdown -->
<div class="relative group ml-1">
  <button
    class="relative w-11 h-11 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center transition text-lg">
    👤
    <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition pointer-events-none z-50">
      Profile
    </span>
  </button>

  <!-- Invisible bridge to prevent gap -->
  <div class="absolute top-10 -right-14 w-48 h-4 hidden group-hover:block"></div>

  <div
    class="absolute -right-30 top-12 bg-white text-gray-700 shadow-lg overflow-hidden hidden group-hover:block z-50 border border-gray-100"
    style="min-width: max-content;">

              <NuxtLink to="/dashboard"
                class="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-sm text-gray-700 transition border-b border-gray-100">
                <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                My Listings
              </NuxtLink>

              <NuxtLink to="/saved"
                class="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-sm text-gray-700 transition border-b border-gray-100">
                <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                </svg>
                Saved Listings
              </NuxtLink>

              <NuxtLink to="/profile/edit"
                class="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-sm text-gray-700 transition border-b border-gray-100">
                <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                Settings
              </NuxtLink>

              <button @click="logout"
                class="w-full flex items-center gap-3 px-5 py-3 hover:bg-red-50 text-sm text-red-500 transition">
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Log out
              </button>

            </div>
          </div>

        </template>

        <!-- Sell Button -->
        <NuxtLink to="/listings/new"
          class="bg-orange-500 hover:bg-orange-600 px-6 py-2.5 rounded-xl font-bold transition ml-2 text-sm">
          Sell
        </NuxtLink>

      </div>
    </div>
  </nav>
</template>