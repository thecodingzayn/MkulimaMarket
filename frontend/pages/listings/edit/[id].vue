<script setup>
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

const { data: { user } } = await supabase.auth.getUser()

const { data: listing } = await useAsyncData('listing', async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', route.params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return null
  return data
})

if (!listing.value) navigateTo('/')

const expiryOptions = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
]

const form = ref({
  title: listing.value?.title ?? '',
  description: listing.value?.description ?? '',
  price: listing.value?.price ?? '',
  location: listing.value?.location ?? '',
  category: listing.value?.category ?? '',
  image: null,
  expiryDays: null, // null = keep existing expiry
})

const imagePreview = ref(listing.value?.image_url ?? null)
const loading = ref(false)
const error = ref('')

const categories = [
  '🥬 Vegetables', '🍎 Fruits', '🌽 Grains & Cereals',
  '🥛 Dairy Products', '🐔 Poultry', '🐄 Livestock',
  '🌿 Herbs & Spices', '🍯 Honey & Organic',
  '🐟 Fish & Seafood', '🌱 Seedlings & Inputs'
]

const counties = [
  'Nairobi', 'Nakuru', 'Eldoret', 'Kisumu', 'Mombasa',
  'Nyeri', 'Machakos', 'Kiambu', 'Meru', 'Kakamega'
]

// Format current expiry for display
const currentExpiry = computed(() => {
  if (!listing.value?.expires_at) return null
  return new Date(listing.value.expires_at).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
})

// Days remaining on current listing
const daysRemaining = computed(() => {
  if (!listing.value?.expires_at) return null
  const diff = new Date(listing.value.expires_at) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

// Preview of new expiry if extending
const newExpiryPreview = computed(() => {
  if (!form.value.expiryDays) return null
  const d = new Date()
  d.setDate(d.getDate() + form.value.expiryDays)
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
})

const hasChanged = computed(() => {
  return (
    form.value.title !== listing.value?.title ||
    form.value.description !== listing.value?.description ||
    form.value.price != listing.value?.price ||
    form.value.location !== listing.value?.location ||
    form.value.category !== listing.value?.category ||
    form.value.image !== null ||
    form.value.expiryDays !== null
  )
})

const handleImage = (e) => {
  const file = e.target.files[0]
  form.value.image = file
  imagePreview.value = URL.createObjectURL(file)
}

const uploadImage = async () => {
  if (!form.value.image) return listing.value?.image_url ?? null

  const fileExt = form.value.image.name.split('.').pop()
  const fileName = `${user.id}-${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, form.value.image)

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)
  return data.publicUrl
}

const saveChanges = async () => {
  loading.value = true
  error.value = ''

  try {
    const imageUrl = await uploadImage()

    // Only update expires_at if user chose a new duration
    let expiresAt = undefined
    if (form.value.expiryDays) {
      const d = new Date()
      d.setDate(d.getDate() + form.value.expiryDays)
      expiresAt = d.toISOString()
    }

    const updatePayload = {
      title: form.value.title,
      description: form.value.description,
      price: parseFloat(form.value.price),
      location: form.value.location,
      category: form.value.category,
      image_url: imageUrl,
    }

    if (expiresAt) updatePayload.expires_at = expiresAt

    const { error: updateError } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', route.params.id)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    router.push(`/listings/${route.params.id}`)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-10">
    <div class="flex items-center gap-3 mb-6">
      <button @click="$router.back()" class="text-gray-500 hover:text-green-600 transition">←</button>
      <h1 class="text-2xl font-bold text-gray-800">Edit Listing</h1>
    </div>

    <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
      {{ error }}
    </div>

    <div class="bg-white rounded-2xl shadow p-6 space-y-5">

      <!-- Title -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Title</label>
        <input v-model="form.title" type="text"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <!-- Description -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Description</label>
        <textarea v-model="form.description" rows="4"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <!-- Price -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Price (KSh)</label>
        <input v-model="form.price" type="number" min="0"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <!-- Category -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Category</label>
        <select v-model="form.category"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>

      <!-- Location -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Location</label>
        <select v-model="form.location"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option v-for="county in counties" :key="county" :value="county">{{ county }}</option>
        </select>
      </div>

      <!-- Expiry -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Listing Expiry</label>

        <!-- Current expiry info -->
        <div v-if="currentExpiry" class="mb-2 px-4 py-3 rounded-lg text-sm"
          :class="daysRemaining <= 3
            ? 'bg-red-50 text-red-600'
            : daysRemaining <= 7
              ? 'bg-orange-50 text-orange-600'
              : 'bg-gray-50 text-gray-500'"
        >
          <span v-if="daysRemaining > 0">
            ⏳ Currently expires on <strong>{{ currentExpiry }}</strong>
            ({{ daysRemaining }} day{{ daysRemaining === 1 ? '' : 's' }} remaining)
          </span>
          <span v-else>⚠️ This listing expired on {{ currentExpiry }}</span>
        </div>

        <!-- Extend option -->
        <select v-model="form.expiryDays"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option :value="null">Keep current expiry</option>
          <option v-for="opt in expiryOptions" :key="opt.value" :value="opt.value">
            Extend by {{ opt.label }}
          </option>
        </select>

        <p v-if="newExpiryPreview" class="text-xs text-green-600 mt-1">
          ✅ New expiry will be <strong>{{ newExpiryPreview }}</strong>
        </p>
      </div>

      <!-- Image -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Product Image</label>
        <div v-if="imagePreview" class="mb-3">
          <img :src="imagePreview" class="w-full h-48 object-cover rounded-lg" />
        </div>
        <input type="file" accept="image/*" @change="handleImage"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
      </div>

      <div class="flex gap-3 pt-2">
        <button @click="router.back()"
          class="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-3 rounded-lg font-semibold transition">
          Cancel
        </button>
        <button @click="saveChanges" :disabled="!hasChanged || loading"
          class="flex-1 py-3 rounded-lg font-semibold transition"
          :class="hasChanged ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'">
          {{ loading ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>

    </div>
  </div>
</template>