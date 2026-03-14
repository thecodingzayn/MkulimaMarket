<script setup>
const supabase = useSupabaseClient()
const route = useRoute()

const { data: { user } } = await supabase.auth.getUser()

const { data: profile } = await useAsyncData('profile-sidebar', async () => {
  const { data } = await supabase
    .from('profiles')
    .select('name, phone, avatar_url, location')
    .eq('id', user.id)
    .single()
  return data
})

const navItems = [
  { label: 'My Adverts', icon: '📋', to: '/dashboard' },
  { label: 'Saved', icon: '🔖', to: '/saved' },
  { label: 'Messages', icon: '💬', to: '/messages' },
  { label: 'Notifications', icon: '🔔', to: '/notifications' },
  { label: 'Settings', icon: '⚙️', to: '/profile/edit' },
]
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-5xl mx-auto px-4">
      <div class="flex gap-6 items-start">

        <!-- Left Sidebar -->
        <div class="w-64 shrink-0 bg-white rounded-2xl shadow-sm overflow-hidden">

          <!-- Profile -->
          <div class="px-6 py-6 text-center border-b">
            <div class="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-4xl mx-auto mb-3">
              <img v-if="profile?.avatar_url" :src="profile.avatar_url" class="w-full h-full object-cover rounded-full" />
              <span v-else>👤</span>
            </div>
            <p class="font-bold text-gray-800">{{ profile?.name ?? user.user_metadata?.name }}</p>
            <p class="text-sm text-gray-400 mt-0.5">{{ profile?.phone ?? '' }}</p>
            <NuxtLink to="/profile/edit"
              class="mt-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 transition">
              ⚙️ Settings
            </NuxtLink>
          </div>

          <!-- Nav -->
          <nav class="py-2">
            <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to"
              class="flex items-center gap-3 px-6 py-3 text-sm font-medium transition hover:bg-gray-50"
              :class="route.path === item.to
                ? 'text-green-600 bg-green-50 border-r-4 border-green-500'
                : 'text-gray-600'">
              <span>{{ item.icon }}</span>
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>

        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          <slot />
        </div>

      </div>
    </div>
  </div>
</template>