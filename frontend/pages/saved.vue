<script setup>
definePageMeta({ middleware: ['auth', 'no-admin'] })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const { data: savedListings, refresh } = await useAsyncData('saved', async () => {
  const { data: saved } = await supabase
    .from('saved_listings')
    .select('id, created_at, products(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!saved?.length) return []

  const ownerIds = [...new Set(saved.map(s => s.products?.user_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .in('id', ownerIds)

  const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) ?? [])

  return saved.map(s => ({
    ...s,
    products: {
      ...s.products,
      profile: profileMap[s.products?.user_id] ?? null
    }
  }))
})

// Single declaration — starts empty, only adds on click
const revealedContacts = ref(new Set())

const toggleContact = (id) => {
  const s = new Set(revealedContacts.value)
  s.add(id)
  revealedContacts.value = s
}

const formatPhone = (phone) => phone?.replace(/\s+/g, '') ?? ''

const unsave = async (productId) => {
  await supabase.from('saved_listings')
    .delete()
    .eq('user_id', user.id)
    .eq('product_id', productId)
  await refresh()
}

const timeAgo = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(date).toLocaleDateString('en-KE')
}
</script>

<template>
  <ProfileLayout>
    <div class="bg-white rounded-2xl shadow-sm overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-5 border-b">
        <h1 class="text-xl font-bold text-gray-800">
          My Saved
          <span class="text-sm font-normal text-gray-400 ml-1">({{ savedListings.length }})</span>
        </h1>
        <button v-if="savedListings.length > 0"
          @click="async () => { for (const s of savedListings) await unsave(s.products.id) }"
          class="text-sm text-green-600 hover:underline font-medium">
          Clear all
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="savedListings.length === 0" class="py-24 text-center">
        <div class="text-5xl mb-4">🔖</div>
        <p class="text-gray-500 font-semibold">No saved listings yet</p>
        <p class="text-gray-400 text-sm mt-1">Tap the bookmark icon on any listing to save it</p>
        <NuxtLink to="/" class="mt-4 inline-block text-green-600 hover:underline text-sm">
          Browse listings →
        </NuxtLink>
      </div>

      <!-- List -->
      <div v-else class="divide-y">
        <div v-for="item in savedListings" :key="item.id"
          class="flex items-center gap-5 px-6 py-4 hover:bg-gray-50 transition group relative">

          <!-- Image -->
          <NuxtLink :to="`/listings/${item.products.id}`"
            class="w-28 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100 border border-gray-100">
            <img v-if="item.products.image_url"
              :src="item.products.image_url"
              class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
            <div v-else class="w-full h-full flex items-center justify-center text-3xl">🌾</div>
          </NuxtLink>

          <!-- Details -->
          <div class="flex-1 min-w-0">
            <NuxtLink :to="`/listings/${item.products.id}`">
              <h3 class="font-semibold text-gray-800 hover:text-green-600 transition leading-snug line-clamp-2">
                {{ item.products.title }}
              </h3>
            </NuxtLink>
            <p class="text-green-600 font-bold text-base mt-1">
              KSh {{ Number(item.products.price).toLocaleString('en-KE') }}
            </p>
            <div class="flex items-center gap-3 mt-1.5 flex-wrap">
              <span class="text-xs text-gray-400">📍 {{ item.products.location }}</span>
              <span class="text-xs text-gray-400">🌿 {{ item.products.category }}</span>
              <span class="text-xs text-gray-400">🕒 Saved {{ timeAgo(item.created_at) }}</span>
            </div>
          </div>

          <!-- Actions — fade in on hover -->
          <div class="flex flex-col gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mr-6">

            <NuxtLink :to="`/messages`"
              class="w-40 py-2 text-center border-2 border-green-500 text-green-600 rounded-lg text-sm font-semibold hover:bg-green-50 transition">
              💬 Chat
            </NuxtLink>

            <!-- Show contact → replaced by phone on click -->
            <button v-if="!revealedContacts.has(item.products.id)"
              @click="toggleContact(item.products.id)"
              class="w-40 py-2 text-center bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition">
              📞 Show contact
            </button>

            <a v-else-if="item.products.profile?.phone"
              :href="`tel:${formatPhone(item.products.profile.phone)}`"
              class="w-40 py-2 text-center bg-green-500 hover:bg-green-600 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-1">
              📞 {{ item.products.profile.phone }}
            </a>

            <div v-else
              class="w-40 py-2 text-center text-xs text-gray-400 bg-gray-50 rounded-lg border border-gray-100">
              No phone listed
            </div>

            <!-- Remove -->
            <button @click="unsave(item.products.id)"
              class="w-40 py-1.5 text-center text-xs text-gray-400 hover:text-red-400 border border-gray-200 hover:border-red-200 rounded-lg transition">
              ✕ Remove
            </button>

          </div>
        </div>
      </div>

    </div>
  </ProfileLayout>
</template>