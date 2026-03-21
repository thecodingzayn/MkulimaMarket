<script setup>
import { Icon } from '@iconify/vue'

definePageMeta({ middleware: ['auth', 'no-admin'] })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

const MAX_IMAGES = 5

const form = ref({
  title: '',
  description: '',
  price: '',
  quantity: '',
  location: '',
  category: '',
  expiryDays: 30,
})

const images = ref([])
const loading = ref(false)
const error = ref('')

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

// Show market widget when category selected AND title has 3+ chars
const showMarketWidget = computed(() =>
  !!form.value.category && form.value.title.trim().length > 2
)

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

const handleImages = (e) => {
  const files = Array.from(e.target.files)
  const remaining = MAX_IMAGES - images.value.length
  const toAdd = files.slice(0, remaining)
  toAdd.forEach(file => {
    images.value.push({ file, preview: URL.createObjectURL(file) })
  })
  e.target.value = ''
}

const removeImage = (index) => {
  URL.revokeObjectURL(images.value[index].preview)
  images.value.splice(index, 1)
}

const moveImage = (from, to) => {
  if (to < 0 || to >= images.value.length) return
  const item = images.value.splice(from, 1)[0]
  images.value.splice(to, 0, item)
}

const uploadImages = async (productId) => {
  const { data: { user: u } } = await supabase.auth.getUser()
  for (let i = 0; i < images.value.length; i++) {
    const { file } = images.value[i]
    const fileExt = file.name.split('.').pop()
    const fileName = `${u.id}-${productId}-${i}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)

    await supabase.from('listing_images').insert({
      product_id: productId,
      url: data.publicUrl,
      position: i
    })
  }
}

const submitListing = async () => {
  loading.value = true
  error.value = ''

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + form.value.expiryDays)

    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert({
        title: form.value.title,
        description: form.value.description,
        price: parseFloat(form.value.price),
        quantity: form.value.quantity || null,
        location: form.value.location,
        category: form.value.category,
        user_id: session?.user?.id,
        status: 'reviewing',
        review_reason: 'new_listing',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (insertError) throw insertError

    if (images.value.length > 0) {
      await uploadImages(product.id)
    }

    router.push('/dashboard')
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
        <input v-model="form.title" type="text" placeholder="e.g. Fresh Tomatoes 1kg"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <!-- Description -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Description</label>
        <textarea v-model="form.description" rows="4" placeholder="Describe your produce..."
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <!-- Price -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Price (KSh)</label>
        <input v-model="form.price" type="number" min="0" placeholder="e.g. 150"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <!-- Quantity -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Quantity Available</label>
        <input v-model="form.quantity" type="text" placeholder="e.g. 50kg, 200 pieces, 10 crates"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      <!-- Category -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Category</label>
        <select v-model="form.category"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Select a category</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>

      <!-- Market price widget — reacts to both title and category -->
      <div v-if="showMarketWidget">
        <MarketPriceWidget
          :category="form.category"
          :query="form.title"
          mode="suggest"
        />
      </div>

      <!-- Hint when category selected but title too short -->
      <p v-else-if="form.category && form.title.trim().length <= 2"
        class="text-xs text-gray-400 -mt-2 flex items-center gap-1">
        <Icon icon="mdi:information-outline" class="w-3.5 h-3.5" />
        Type your product title to see market price insights
      </p>

      <!-- Location -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Location</label>
        <select v-model="form.location"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Select your county</option>
          <option v-for="county in counties" :key="county" :value="county">{{ county }}</option>
        </select>
      </div>

      <!-- Listing Duration -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">Listing Duration</label>
        <select v-model="form.expiryDays"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option v-for="opt in expiryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <p class="text-xs text-gray-400 mt-1 flex items-center gap-1">
          <Icon icon="mdi:clock-outline" class="w-3.5 h-3.5" />
          Expires on <span class="font-medium text-gray-600">{{ expiryDate }}</span>
        </p>
      </div>

      <!-- Image Upload -->
      <div>
        <label class="text-sm text-gray-600 mb-1 block">
          Product Images
          <span class="text-gray-400">(up to {{ MAX_IMAGES }}, first is cover)</span>
        </label>

        <div v-if="images.length > 0" class="grid grid-cols-3 gap-2 mb-3">
          <div v-for="(img, i) in images" :key="i" class="relative group">
            <img :src="img.preview" class="w-full h-24 object-cover rounded-lg" />
            <div v-if="i === 0"
              class="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded font-semibold">
              Cover
            </div>
            <button @click="removeImage(i)"
              class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <Icon icon="mdi:close" class="w-3.5 h-3.5" />
            </button>
            <div class="absolute bottom-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button v-if="i > 0" @click="moveImage(i, i - 1)"
                class="w-5 h-5 bg-black bg-opacity-60 text-white rounded flex items-center justify-center">
                <Icon icon="mdi:chevron-left" class="w-3 h-3" />
              </button>
              <button v-if="i < images.length - 1" @click="moveImage(i, i + 1)"
                class="w-5 h-5 bg-black bg-opacity-60 text-white rounded flex items-center justify-center">
                <Icon icon="mdi:chevron-right" class="w-3 h-3" />
              </button>
            </div>
          </div>

          <label v-if="images.length < MAX_IMAGES"
            class="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition">
            <Icon icon="mdi:plus" class="w-6 h-6 text-gray-400" />
            <span class="text-xs text-gray-400 mt-1">Add more</span>
            <input type="file" accept="image/*" multiple class="hidden" @change="handleImages" />
          </label>
        </div>

        <label v-if="images.length === 0"
          class="w-full h-36 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition">
          <Icon icon="mdi:image-plus" class="w-10 h-10 text-gray-400 mb-2" />
          <span class="text-sm text-gray-500 font-medium">Click to upload photos</span>
          <span class="text-xs text-gray-400 mt-1">Up to {{ MAX_IMAGES }} images · JPG, PNG</span>
          <input type="file" accept="image/*" multiple class="hidden" @change="handleImages" />
        </label>

        <p class="text-xs text-gray-400 mt-1">
          {{ images.length }}/{{ MAX_IMAGES }} images · Drag arrows to reorder · First image is the cover
        </p>
      </div>

      <!-- Submit -->
      <button @click="submitListing" :disabled="loading"
        class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
        <Icon v-if="loading" icon="mdi:loading" class="w-5 h-5 animate-spin" />
        {{ loading ? 'Posting...' : 'Post Listing' }}
      </button>

    </div>
  </div>
</template>