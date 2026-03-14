<template>
  <div class="relative">
    <NuxtLink :to="`/listings/${product.id}`" class="block">
      <div class="bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden">

        <!-- Image -->
        <div class="h-48 bg-gray-100 overflow-hidden relative">
          <img v-if="product.image_url" :src="product.image_url" :alt="product.title"
            class="w-full h-full object-cover hover:scale-105 transition duration-300" />
          <div v-else class="w-full h-full flex items-center justify-center text-4xl">🌾</div>
          <!-- Boost badge -->
<div v-if="product.is_boosted"
  class="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
  🔥 Featured
</div>

          <!-- Expiry badge -->
          <div v-if="expiryBadge" class="absolute top-2 left-2 text-xs font-semibold px-2 py-1 rounded-full"
            :class="expiryBadge.class">
            {{ expiryBadge.label }}
          </div>
          
        </div>

        <!-- Info -->
        <div class="p-3">
          <h3 class="font-semibold text-gray-800 truncate">{{ product.title }}</h3>
          <p class="text-green-600 font-bold text-lg">KSh {{ product.price }}</p>
          <p v-if="product.quantity" class="text-xs text-gray-400 mt-0.5">
  📦 {{ product.quantity }}
</p>
          <div class="flex justify-between text-xs text-gray-400 mt-2">
            <span>📍 {{ product.location }}</span>
            <span>{{ product.category }}</span>
          </div>
        </div>

      </div>
    </NuxtLink>
  </div>
</template>

<script setup>
const props = defineProps({ product: Object })

const supabase = useSupabaseClient()
const saved = ref(false)
const user = ref(null)

onMounted(async () => {
  const { data: { user: u } } = await supabase.auth.getUser()
  user.value = u
  if (!u) return

  const { data } = await supabase
    .from('saved_listings')
    .select('id')
    .eq('user_id', u.id)
    .eq('product_id', props.product.id)
    .maybeSingle()

  saved.value = !!data
})

const toggleSave = async () => {
  if (!user.value) return
  if (saved.value) {
    await supabase.from('saved_listings')
      .delete()
      .eq('user_id', user.value.id)
      .eq('product_id', props.product.id)
    saved.value = false
  } else {
    await supabase.from('saved_listings')
      .insert({ user_id: user.value.id, product_id: props.product.id })
    saved.value = true
  }
}

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