<script setup>
import { Icon } from '@iconify/vue'

definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()
const { data: { user } } = await supabase.auth.getUser()

const MAX_IMAGES = 5

const { data: listing } = await useAsyncData('listing', async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*, listing_images(id, url, position)')
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
  quantity: listing.value?.quantity ?? '',
  location: listing.value?.location ?? '',
  category: listing.value?.category ?? '',
  expiryDays: null,
})

// Existing images from DB
const existingImages = ref(
  [...(listing.value?.listing_images ?? [])].sort((a, b) => a.position - b.position)
)

// New images to upload
const newImages = ref([]) // { file, preview }

const imagesToDelete = ref([]) // IDs of existing images to delete

const totalImageCount = computed(() => existingImages.value.length + newImages.value.length)

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

const currentExpiry = computed(() => {
  if (!listing.value?.expires_at) return null
  return new Date(listing.value.expires_at).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
})

const daysRemaining = computed(() => {
  if (!listing.value?.expires_at) return null
  return Math.ceil((new Date(listing.value.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
})

const newExpiryPreview = computed(() => {
  if (!form.value.expiryDays) return null
  const d = new Date()
  d.setDate(d.getDate() + form.value.expiryDays)
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
})

const handleNewImages = (e) => {
  const files = Array.from(e.target.files)
  const remaining = MAX_IMAGES - totalImageCount.value
  files.slice(0, remaining).forEach(file => {
    newImages.value.push({ file, preview: URL.createObjectURL(file) })
  })
  e.target.value = ''
}

const removeExistingImage = (index) => {
  const img = existingImages.value.splice(index, 1)[0]
  imagesToDelete.value.push(img.id)
}

const removeNewImage = (index) => {
  URL.revokeObjectURL(newImages.value[index].preview)
  newImages.value.splice(index, 1)
}

const moveExisting = (from, to) => {
  if (to < 0 || to >= existingImages.value.length) return
  const item = existingImages.value.splice(from, 1)[0]
  existingImages.value.splice(to, 0, item)
}

const saveChanges = async () => {
  loading.value = true
  error.value = ''

  try {
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
      quantity: form.value.quantity || null,
      location: form.value.location,
      category: form.value.category,
      status: 'reviewing',
      review_reason: 'updated_listing',
      rejection_reason: null,
    }
    if (expiresAt) updatePayload.expires_at = expiresAt

    const { error: updateError } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', route.params.id)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    // Delete removed images
    if (imagesToDelete.value.length > 0) {
      await supabase.from('listing_images').delete().in('id', imagesToDelete.value)
    }

    // Update positions of remaining existing images
    for (let i = 0; i < existingImages.value.length; i++) {
      await supabase.from('listing_images')
        .update({ position: i })
        .eq('id', existingImages.value[i].id)
    }

    // Upload new images
    const startPosition = existingImages.value.length
    for (let i = 0; i < newImages.value.length; i++) {
      const { file } = newImages.value[i]
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${route.params.id}-${startPosition + i}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)

      await supabase.from('listing_images').insert({
        product_id: Number(route.params.id),
        url: data.publicUrl,
        position: startPosition + i
      })
    }

    router.push(`/listings/${route.params.id}`)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

    <div class="flex items-center gap-3 mb-5 sm:mb-6">
      <button @click="$router.back()" class="text-gray-500 hover:text-green-600 transition">
        <Icon icon="mdi:arrow-left" class="w-5 h-5" />
      </button>
      <h1 class="text-xl sm:text-2xl font-bold text-gray-800">Edit Listing</h1>
    </div>

    <div v-if="error" class="bg-red-50 text-red-600 text-xs sm:text-sm px-4 py-3 rounded-lg mb-4">
      {{ error }}
    </div>

    <div class="bg-white rounded-xl sm:rounded-2xl shadow p-4 sm:p-6 space-y-5">

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
        <div v-if="currentExpiry" class="mb-2 px-4 py-3 rounded-lg text-sm"
          :class="daysRemaining <= 3 ? 'bg-red-50 text-red-600' : daysRemaining <= 7 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-500'">
          <span v-if="daysRemaining > 0">
            <Icon icon="mdi:clock-outline" class="w-4 h-4 inline mr-1" />
            Currently expires on <strong>{{ currentExpiry }}</strong>
            ({{ daysRemaining }} day{{ daysRemaining === 1 ? '' : 's' }} remaining)
          </span>
          <span v-else>
            <Icon icon="mdi:alert" class="w-4 h-4 inline mr-1" />
            This listing expired on {{ currentExpiry }}
          </span>
        </div>
        <select v-model="form.expiryDays"
          class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option :value="null">Keep current expiry</option>
          <option v-for="opt in expiryOptions" :key="opt.value" :value="opt.value">Extend by {{ opt.label }}</option>
        </select>
        <p v-if="newExpiryPreview" class="text-xs text-green-600 mt-1">
          <Icon icon="mdi:check-circle" class="w-3.5 h-3.5 inline mr-1" />
          New expiry will be <strong>{{ newExpiryPreview }}</strong>
        </p>
      </div>

      <!-- Images -->
      <div>
        <label class="text-sm text-gray-600 mb-2 block">
          Product Images
          <span class="text-gray-400">({{ totalImageCount }}/{{ MAX_IMAGES }})</span>
        </label>

        <!-- Image grid -->
        <div v-if="existingImages.length > 0 || newImages.length > 0" class="grid grid-cols-3 gap-2 mb-3">

          <!-- Existing images -->
          <div v-for="(img, i) in existingImages" :key="img.id" class="relative group">
            <img :src="img.url" class="w-full h-24 object-cover rounded-lg" />
            <div v-if="i === 0 && newImages.length === 0"
              class="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded font-semibold">
              Cover
            </div>
            <button @click="removeExistingImage(i)"
              class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <Icon icon="mdi:close" class="w-3.5 h-3.5" />
            </button>
            <div class="absolute bottom-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button v-if="i > 0" @click="moveExisting(i, i - 1)"
                class="w-5 h-5 bg-black bg-opacity-60 text-white rounded flex items-center justify-center">
                <Icon icon="mdi:chevron-left" class="w-3 h-3" />
              </button>
              <button v-if="i < existingImages.length - 1" @click="moveExisting(i, i + 1)"
                class="w-5 h-5 bg-black bg-opacity-60 text-white rounded flex items-center justify-center">
                <Icon icon="mdi:chevron-right" class="w-3 h-3" />
              </button>
            </div>
          </div>

          <!-- New images -->
          <div v-for="(img, i) in newImages" :key="`new-${i}`" class="relative group">
            <img :src="img.preview" class="w-full h-24 object-cover rounded-lg border-2 border-green-300" />
            <div class="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded font-semibold">
              New
            </div>
            <button @click="removeNewImage(i)"
              class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <Icon icon="mdi:close" class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Add more -->
          <label v-if="totalImageCount < MAX_IMAGES"
            class="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition">
            <Icon icon="mdi:plus" class="w-6 h-6 text-gray-400" />
            <span class="text-xs text-gray-400 mt-1">Add more</span>
            <input type="file" accept="image/*" multiple class="hidden" @change="handleNewImages" />
          </label>
        </div>

        <!-- Initial upload area (no images) -->
        <label v-if="totalImageCount === 0"
          class="w-full h-36 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition">
          <Icon icon="mdi:image-plus" class="w-10 h-10 text-gray-400 mb-2" />
          <span class="text-sm text-gray-500 font-medium">Click to upload photos</span>
          <span class="text-xs text-gray-400 mt-1">Up to {{ MAX_IMAGES }} images</span>
          <input type="file" accept="image/*" multiple class="hidden" @change="handleNewImages" />
        </label>

        <p class="text-xs text-gray-400 mt-1">First image is the cover · Hover to reorder or remove</p>
      </div>

      <!-- Buttons -->
      <div class="flex flex-col sm:flex-row gap-3 pt-2">
        <button @click="router.back()"
          class="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-3 rounded-lg font-semibold transition">
          Cancel
        </button>
        <button @click="saveChanges" :disabled="loading"
          class="flex-1 py-3 rounded-lg font-semibold transition bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300 flex items-center justify-center gap-2">
          <Icon v-if="loading" icon="mdi:loading" class="w-5 h-5 animate-spin" />
          {{ loading ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>

    </div>
  </div>
</template>