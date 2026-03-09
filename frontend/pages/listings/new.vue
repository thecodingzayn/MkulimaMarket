<script setup>
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  console.log('Session:', data.session)
  console.log('User:', data.session?.user)
})

const form = ref({
  title: '',
  description: '',
  price: '',
  location: '',
  category: '',
  image: null,
  expiryDays: 30,
})

const loading = ref(false)
const error = ref('')
const imagePreview = ref(null)

const expiryOptions = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
]

const expiryDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + form.value.expiryDays)
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
})

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

const handleImage = (e) => {
  const file = e.target.files[0]
  form.value.image = file
  imagePreview.value = URL.createObjectURL(file)
}

const uploadImage = async () => {
  if (!form.value.image) return null

  const fileExt = form.value.image.name.split('.').pop()
  const fileName = `${user.value.id}-${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, form.value.image)

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName)

  return data.publicUrl
}

const submitListing = async () => {
  loading.value = true
  error.value = ''

  try {
    const { data: { session } } = await supabase.auth.getSession()

    const imageUrl = await uploadImage()

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + form.value.expiryDays)

    const { error: insertError } = await supabase
      .from('products')
      .insert({
        title: form.value.title,
        description: form.value.description,
        price: parseFloat(form.value.price),
        location: form.value.location,
        category: form.value.category,
        image_url: imageUrl,
        user_id: session?.user?.id,
        status: 'active',
        expires_at: expiresAt.toISOString(),
      })

    if (insertError) throw insertError

    router.push('/')
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-10">
    <h1 class="text-2xl font-bold text-gray-800 mb-6">Post a Listing</h1>

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
          placeholder="e.g. Fresh Tomatoes 1kg"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <!-- Description -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Description</label>
        <textarea
          v-model="form.description"
          rows="4"
          placeholder="Describe your produce..."
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
          placeholder="e.g. 150"
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
          <option value="">Select a category</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>

      <!-- Location -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Location</label>
        <select
          v-model="form.location"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Select your county</option>
          <option v-for="county in counties" :key="county" :value="county">{{ county }}</option>
        </select>
      </div>

      <!-- Listing Duration -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Listing Duration</label>
        <select
          v-model="form.expiryDays"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option v-for="opt in expiryOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <p class="text-xs text-gray-400 mt-1">
          ⏳ Expires on <span class="font-medium text-gray-600">{{ expiryDate }}</span>
        </p>
      </div>

      <!-- Image Upload -->
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

      <!-- Submit -->
      <button
        @click="submitListing"
        :disabled="loading"
        class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
      >
        {{ loading ? 'Posting...' : 'Post Listing' }}
      </button>

    </div>
  </div>
</template>