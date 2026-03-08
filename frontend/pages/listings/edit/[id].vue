<script setup>
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

const { data: { user } } = await supabase.auth.getUser()

// Fetch existing listing
const { data: listing } = await useAsyncData('listing', async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', route.params.id)
    .eq('user_id', user.id) // only owner can edit
    .single()

  if (error || !data) return null
  return data
})

// Redirect if not owner
if (!listing.value) {
  navigateTo('/')
}

const form = ref({
  title: listing.value?.title ?? '',
  description: listing.value?.description ?? '',
  price: listing.value?.price ?? '',
  location: listing.value?.location ?? '',
  category: listing.value?.category ?? '',
  image: null,
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

// Track if anything has changed
const hasChanged = computed(() => {
  return (
    form.value.title !== listing.value?.title ||
    form.value.description !== listing.value?.description ||
    form.value.price != listing.value?.price ||
    form.value.location !== listing.value?.location ||
    form.value.category !== listing.value?.category ||
    form.value.image !== null
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

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName)

  return data.publicUrl
}

const saveChanges = async () => {
  loading.value = true
  error.value = ''

  try {
    const imageUrl = await uploadImage()

    const { error: updateError } = await supabase
      .from('products')
      .update({
        title: form.value.title,
        description: form.value.description,
        price: parseFloat(form.value.price),
        location: form.value.location,
        category: form.value.category,
        image_url: imageUrl,
      })
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
      <button
        @click="$router.back()"
        class="text-gray-500 hover:text-green-600 transition"
      >
        ←
      </button>
      <h1 class="text-2xl font-bold text-gray-800">Edit Listing</h1>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
      {{ error }}
    </div>

    <div class="bg-white rounded-2xl shadow p-6 space-y-5">

      <!-- Title -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Title</label>
        <input
          v-model="form.title"
          type="text"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <!-- Description -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Description</label>
        <textarea
          v-model="form.description"
          rows="4"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <!-- Price -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Price (KSh)</label>
        <input
          v-model="form.price"
          type="number"
          min="0"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <!-- Category -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Category</label>
        <select
          v-model="form.category"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option v-for="cat in categories" :key="cat" :value="cat">
            {{ cat }}
          </option>
        </select>
      </div>

      <!-- Location -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Location</label>
        <select
          v-model="form.location"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option v-for="county in counties" :key="county" :value="county">
            {{ county }}
          </option>
        </select>
      </div>

      <!-- Image -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Product Image</label>
        <div v-if="imagePreview" class="mb-3">
          <img :src="imagePreview" class="w-full h-48 object-cover rounded-lg" />
        </div>
        <input
          type="file"
          accept="image/*"
          @change="handleImage"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm"
        />
      </div>

      <div class="flex gap-3 pt-2">
        <button
          @click="router.back()"
          class="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-3 rounded-lg font-semibold transition"
        >
          Cancel
        </button>

      <!-- Save Button - disabled until change is made -->
      <button
  @click="saveChanges"
  :disabled="!hasChanged || loading"
  class="flex-1 py-3 rounded-lg font-semibold transition"
  :class="hasChanged
    ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
    : 'bg-gray-200 text-gray-400 cursor-not-allowed'"
>
  {{ loading ? 'Saving...' : 'Save Changes' }}
</button>

      </div>

      

    </div>
  </div>
</template>