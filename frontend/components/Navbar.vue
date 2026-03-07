<script setup>
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const logout = async () => {
  await supabase.auth.signOut()
  navigateTo('/auth/login')
}
</script>

<template>
  <nav class="bg-green-600 text-white px-8 py-4 shadow-lg relative z-10">
    <div class="max-w-7xl mx-auto flex justify-between items-center">

      <NuxtLink to="/" class="text-2xl font-bold tracking-wide">MkulimaMarket</NuxtLink>

      <div class="flex items-center gap-4">

        <!-- Logged out -->
        <template v-if="!user">
          <NuxtLink to="/auth/login" class="px-4 py-2 hover:underline transition">
            Sign In
          </NuxtLink>
          <NuxtLink to="/auth/register" class="px-4 py-2 hover:underline transition">
            Register
          </NuxtLink>
        </template>

        <!-- Logged in -->
        <template v-else>
          <NuxtLink to="/dashboard" class="px-4 py-2 hover:underline transition">
            My Listings
          </NuxtLink>
          <span class="text-sm text-green-200">{{ user.user_metadata.name }}</span>
          <button
            @click="logout"
            class="px-4 py-2 hover:underline transition"
          >
            Logout
          </button>
        </template>

        <!-- Sell button always visible -->
        <NuxtLink
          to="/listings/new"
          class="bg-orange-500 hover:bg-orange-600 px-5 py-2 rounded-lg font-semibold transition"
        >
          Sell
        </NuxtLink>

      </div>
    </div>
  </nav>
</template>