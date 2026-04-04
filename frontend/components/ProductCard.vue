<template>
  <div class="relative">
    <NuxtLink :to="`/listings/${product.id}`" class="block">
      <div class="bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden">

        <!-- Image -->
        <div class="h-48 bg-gray-100 overflow-hidden relative">
          <img v-if="coverImage" :src="coverImage" :alt="product.title"
            class="w-full h-full object-cover hover:scale-105 transition duration-300" />
          <div v-else class="w-full h-full flex items-center justify-center">
            <Icon icon="mdi:sprout" class="w-16 h-16 text-gray-300" />
          </div>

          <!-- Expiry badge -->
          <div v-if="expiryBadge" class="absolute top-2 left-2 text-xs font-semibold px-2 py-1 rounded-full"
            :class="expiryBadge.class">
            {{ expiryBadge.label }}
          </div>

          <!-- Boosted badge -->
          <div v-if="product.is_boosted"
            class="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Icon icon="mdi:fire" class="w-3 h-3" />
            Featured
          </div>

          <!-- Multiple images indicator -->
          <div v-if="product.listing_images?.length > 1"
            class="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Icon icon="mdi:image-multiple" class="w-3 h-3" />
            {{ product.listing_images.length }}
          </div>
        </div>

        <!-- Info -->
        <div class="p-3">
          <!-- Title + verified badge -->
          <div class="flex items-center gap-1.5 mb-0.5">
            <h3 class="font-semibold text-gray-800 truncate flex-1">{{ product.title }}</h3>
            <div v-if="product.profiles?.is_verified || product.is_verified"
              class="shrink-0"
              title="Verified Seller">
              <Icon icon="mdi:check-decagram" class="w-4 h-4 text-blue-500" />
            </div>
          </div>

          <p class="text-green-600 font-bold text-lg">
            KSh {{ Number(product.price).toLocaleString('en-KE') }}
          </p>
          <p v-if="product.quantity" class="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Icon icon="mdi:package-variant" class="w-3.5 h-3.5" />
            {{ product.quantity }}
          </p>
          <div class="flex justify-between text-xs text-gray-400 mt-2">
            <span class="flex items-center gap-1">
              <Icon icon="mdi:map-marker" class="w-3.5 h-3.5" />
              {{ product.location }}
            </span>
            <span class="flex items-center gap-1">
              <Icon icon="mdi:tag" class="w-3.5 h-3.5" />
              {{ product.category?.replace(/^\p{Emoji}\s*/u, '') }}
            </span>
          </div>
        </div>

      </div>
    </NuxtLink>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'

const props = defineProps({ product: Object })

const coverImage = computed(() => {
  const imgs = props.product.listing_images
  if (!imgs?.length) return null
  const sorted = [...imgs].sort((a, b) => a.position - b.position)
  return sorted[0]?.url ?? null
})

const expiryBadge = computed(() => {
  if (!props.product.expires_at) return null
  const diff = new Date(props.product.expires_at) - new Date()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return { label: 'Expired', class: 'bg-red-500 text-white' }
  if (days <= 3) return { label: `${days}d left`, class: 'bg-red-500 text-white' }
  if (days <= 7) return { label: `${days}d left`, class: 'bg-orange-400 text-white' }
  return null
})
</script>