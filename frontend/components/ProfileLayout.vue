<script setup>
import { Icon } from '@iconify/vue'

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
  { label: 'My Adverts', icon: 'mdi:clipboard-list-outline', to: '/dashboard' },
  { label: 'Saved', icon: 'mdi:bookmark-outline', to: '/saved' },
  { label: 'Messages', icon: 'mdi:message-outline', to: '/messages' },
  { label: 'Notifications', icon: 'mdi:bell-outline', to: '/notifications' },
  { label: 'Settings', icon: 'mdi:cog-outline', to: '/profile/edit' },
]
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-4 md:py-8">
    <div class="max-w-5xl mx-auto px-3 md:px-4">
      <div class="flex flex-col md:flex-row gap-4 md:gap-6 items-start">

        <!-- Sidebar -->
        <div class="w-full md:w-64 md:shrink-0 bg-white rounded-2xl shadow-sm overflow-hidden">

          <!-- Profile info -->
          <div class="px-4 md:px-6 py-4 md:py-6 border-b">
            <div class="flex items-center gap-3 md:flex-col md:items-center md:text-center">

              <!-- Avatar -->
              <div class="w-14 h-14 md:w-20 md:h-20 rounded-full bg-green-100 flex items-center justify-center shrink-0 md:mx-auto md:mb-3 overflow-hidden">
                <img v-if="profile?.avatar_url"
                  :src="profile.avatar_url"
                  class="w-full h-full object-cover rounded-full" />
                <Icon v-else icon="mdi:account" class="w-8 h-8 md:w-12 md:h-12 text-green-600" />
              </div>

              <!-- Name + phone + settings -->
              <div class="flex-1 min-w-0">
                <p class="font-bold text-gray-800 text-sm md:text-base truncate">
                  {{ profile?.name ?? user.user_metadata?.name }}
                </p>
                <p v-if="profile?.phone" class="text-xs text-gray-400 mt-0.5 truncate flex items-center gap-1">
                  <Icon icon="mdi:phone-outline" class="w-3 h-3 shrink-0" />
                  {{ profile.phone }}
                </p>
                <NuxtLink to="/profile/edit"
                  class="mt-1 md:mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 transition">
                  <Icon icon="mdi:cog-outline" class="w-3.5 h-3.5 shrink-0" />
                  Settings
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Nav -->
          <nav class="py-1 md:py-2">
            <div class="grid grid-cols-2 md:flex md:flex-col border-t md:border-t-0">
              <NuxtLink
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-2 px-3 md:px-6 py-3 text-xs md:text-sm font-medium transition hover:bg-gray-50 border-b border-gray-100 md:border-b-0"
                :class="route.path === item.to
                  ? 'text-green-600 bg-green-50 md:border-r-4 border-green-500'
                  : 'text-gray-600'">
                <Icon :icon="item.icon" class="w-4 h-4 shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </NuxtLink>
            </div>
          </nav>
        </div>

        <!-- Main Content -->
        <div class="flex-1 min-w-0 w-full">
          <slot />
        </div>

      </div>
    </div>
  </div>
</template>