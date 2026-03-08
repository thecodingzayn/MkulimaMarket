<script setup>
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const logout = async () => {
  await supabase.auth.signOut()
  navigateTo('/auth/login')
}
</script>

<template>
  <nav class="bg-green-600 text-white px-8 py-3 shadow-lg relative z-10">
    <div class="max-w-7xl mx-auto flex justify-between items-center">

      <!-- Logo -->
      <NuxtLink to="/" class="text-2xl font-bold tracking-wide">
        MkulimaMarket
      </NuxtLink>

      <!-- Right Side -->
      <div class="flex items-center gap-2">

        <!-- Logged out -->
        <template v-if="!user">
          <NuxtLink
            to="/auth/login"
            class="px-4 py-2 hover:bg-green-700 rounded-lg transition"
          >
            Sign In
          </NuxtLink>
          <NuxtLink
            to="/auth/register"
            class="px-4 py-2 hover:bg-green-700 rounded-lg transition"
          >
            Register
          </NuxtLink>
        </template>

        <!-- Logged in -->
        <template v-else>

          <!-- Saved / Favorites -->
          <NuxtLink
            to="/saved"
            class="w-10 h-10 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center transition"
            title="Saved"
          >
            🔖
          </NuxtLink>

          <!-- Messages -->
          <NuxtLink
            to="/messages"
            class="w-10 h-10 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center transition"
            title="Messages"
          >
            💬
          </NuxtLink>

          <!-- Notifications -->
          <NuxtLink
            to="/notifications"
            class="w-10 h-10 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center transition"
            title="Notifications"
          >
            🔔
          </NuxtLink>

          <!-- My Listings -->
          <NuxtLink
            to="/dashboard"
            class="w-10 h-10 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center transition"
            title="My Listings"
          >
            📋
          </NuxtLink>

          <!-- Profile dropdown -->
          <div class="relative group">
            <button
              class="w-10 h-10 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center transition"
              title="Profile"
            >
              👤
            </button>

            <!-- Dropdown -->
            <div class="absolute right-0 top-12 bg-white text-gray-700 rounded-xl shadow-lg w-48 overflow-hidden hidden group-hover:block z-50">
              <div class="px-4 py-3 border-b">
                <p class="font-semibold text-sm">{{ user.user_metadata.name }}</p>
                <p class="text-xs text-gray-400 truncate">{{ user.email }}</p>
              </div>
              <NuxtLink
                to="/dashboard"
                class="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 text-sm transition"
              >
                📋 My Listings
              </NuxtLink>
              <NuxtLink
                to="/profile/edit"
                class="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 text-sm transition"
              >
                ⚙️ Settings
              </NuxtLink>
              <button
                @click="logout"
                class="w-full flex items-center gap-2 px-4 py-3 hover:bg-red-50 text-red-500 text-sm transition"
              >
                🚪 Logout
              </button>
            </div>
          </div>

        </template>

        <!-- Sell Button - always visible -->
        <NuxtLink
          to="/listings/new"
          class="bg-orange-500 hover:bg-orange-600 px-5 py-2 rounded-lg font-semibold transition ml-2"
        >
          Sell
        </NuxtLink>

      </div>
    </div>
  </nav>
</template>