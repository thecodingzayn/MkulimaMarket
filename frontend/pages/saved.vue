<script setup>
import { Icon } from '@iconify/vue'

definePageMeta({ middleware: ['auth', 'no-admin'] })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const { data: savedListings, refresh } = await useAsyncData('saved', async () => {
  const { data: saved } = await supabase
    .from('saved_listings')
    .select('id, created_at, products(*, listing_images(id, url, position))')
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
    products: { ...s.products, profile: profileMap[s.products?.user_id] ?? null }
  }))
})

const coverImage = (product) => {
  const imgs = product?.listing_images
  if (!imgs?.length) return null
  return [...imgs].sort((a, b) => a.position - b.position)[0]?.url ?? null
}

const revealedContacts = ref(new Set())

const toggleContact = (id) => {
  const s = new Set(revealedContacts.value)
  s.add(id)
  revealedContacts.value = s
}

const formatPhone = (phone) => phone?.replace(/\s+/g, '') ?? ''

const unsave = async (productId) => {
  await supabase.from('saved_listings').delete().eq('user_id', user.id).eq('product_id', productId)
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

      <div class="flex items-center justify-between px-4 md:px-6 py-4 md:py-5 border-b">
        <h1 class="text-base md:text-xl font-bold text-gray-800">
          My Saved
          <span class="text-xs md:text-sm font-normal text-gray-400 ml-1">({{ savedListings.length }})</span>
        </h1>
        <button v-if="savedListings.length > 0"
          @click="async () => { for (const s of savedListings) await unsave(s.products.id) }"
          class="text-xs md:text-sm text-green-600 hover:underline font-medium">
          Clear all
        </button>
      </div>

      <div v-if="savedListings.length === 0" class="py-16 md:py-24 text-center px-4">
        <Icon icon="mdi:bookmark-outline" class="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500 font-semibold text-sm md:text-base">No saved listings yet</p>
        <p class="text-gray-400 text-xs md:text-sm mt-1">Tap the bookmark icon on any listing to save it</p>
        <NuxtLink to="/" class="mt-4 inline-block text-green-600 hover:underline text-sm">Browse listings →</NuxtLink>
      </div>

      <div v-else class="divide-y">
        <div v-for="item in savedListings" :key="item.id"
          class="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-5 px-4 md:px-6 py-4 hover:bg-gray-50 transition group relative">

          <div class="flex items-start gap-3 sm:contents">
            <NuxtLink :to="`/listings/${item.products.id}`"
              class="w-20 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100 border border-gray-100">
              <img v-if="coverImage(item.products)" :src="coverImage(item.products)"
                class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Icon icon="mdi:sprout" class="w-8 h-8 text-gray-300" />
              </div>
            </NuxtLink>

            <div class="flex-1 min-w-0">
              <NuxtLink :to="`/listings/${item.products.id}`">
                <h3 class="font-semibold text-gray-800 hover:text-green-600 transition leading-snug line-clamp-2 text-sm md:text-base">
                  {{ item.products.title }}
                </h3>
              </NuxtLink>
              <p class="text-green-600 font-bold text-sm md:text-base mt-1">
                KSh {{ Number(item.products.price).toLocaleString('en-KE') }}
              </p>
              <div class="flex items-center gap-3 mt-1 flex-wrap">
                <span class="text-xs text-gray-400 flex items-center gap-1">
                  <Icon icon="mdi:map-marker" class="w-3.5 h-3.5" />
                  {{ item.products.location }}
                </span>
                <span class="text-xs text-gray-400 hidden sm:flex items-center gap-1">
                  <Icon icon="mdi:tag" class="w-3.5 h-3.5" />
                  {{ item.products.category?.replace(/^\p{Emoji}\s*/u, '') }}
                </span>
                <span class="text-xs text-gray-400 flex items-center gap-1">
                  <Icon icon="mdi:clock-outline" class="w-3.5 h-3.5" />
                  {{ timeAgo(item.created_at) }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-row sm:flex-col gap-2 sm:shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity sm:duration-200 sm:mr-6">
            <NuxtLink to="/messages"
              class="flex-1 sm:w-36 md:w-40 py-2 text-center border-2 border-green-500 text-green-600 rounded-lg text-xs md:text-sm font-semibold hover:bg-green-50 transition flex items-center justify-center gap-1">
              <Icon icon="mdi:message-outline" class="w-4 h-4" />
              Chat
            </NuxtLink>

            <button v-if="!revealedContacts.has(item.products.id)"
              @click="toggleContact(item.products.id)"
              class="flex-1 sm:w-36 md:w-40 py-2 text-center bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs md:text-sm font-semibold transition flex items-center justify-center gap-1">
              <Icon icon="mdi:phone-outline" class="w-4 h-4" />
              Contact
            </button>
            <a v-else-if="item.products.profile?.phone"
              :href="`tel:${formatPhone(item.products.profile.phone)}`"
              class="flex-1 sm:w-36 md:w-40 py-2 text-center bg-green-500 hover:bg-green-600 text-white font-semibold text-xs md:text-sm rounded-lg transition flex items-center justify-center gap-1">
              <Icon icon="mdi:phone" class="w-4 h-4" />
              {{ item.products.profile.phone }}
            </a>
            <div v-else class="flex-1 sm:w-36 md:w-40 py-2 text-center text-xs text-gray-400 bg-gray-50 rounded-lg border border-gray-100">
              No phone listed
            </div>

            <button @click="unsave(item.products.id)"
              class="sm:w-36 md:w-40 py-1.5 text-center text-xs text-gray-400 hover:text-red-400 border border-gray-200 hover:border-red-200 rounded-lg transition hidden sm:flex items-center justify-center gap-1">
              <Icon icon="mdi:close" class="w-3.5 h-3.5" />
              Remove
            </button>
          </div>

          <button @click="unsave(item.products.id)"
            class="sm:hidden text-xs text-gray-400 hover:text-red-400 text-left transition flex items-center gap-1">
            <Icon icon="mdi:close" class="w-3.5 h-3.5" />
            Remove from saved
          </button>
        </div>
      </div>

    </div>
  </ProfileLayout>
</template>