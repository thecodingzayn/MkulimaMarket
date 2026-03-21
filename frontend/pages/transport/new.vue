<script setup>
import { Icon } from '@iconify/vue'
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()
const router = useRouter()

const form = ref({
  pickup_location: '',
  destination: '',
  cargo_type: '',
  quantity: '',
  preferred_date: '',
  preferred_time: '',
  budget: '',
  contact_phone: ''
})

const loading = ref(false)
const error = ref('')

const submit = async () => {
  loading.value = true
  error.value = ''
  const { error: err } = await supabase.from('transport_requests').insert({
    ...form.value,
    user_id: user.id,
    budget: form.value.budget ? Number(form.value.budget) : null
  })
  loading.value = false
  if (err) { error.value = err.message; return }
  router.push('/transport')
}
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-4 md:py-8">
    <div class="max-w-xl mx-auto px-3 md:px-4">

      <button @click="$router.back()"
        class="text-gray-500 hover:text-green-600 mb-4 md:mb-6 flex items-center gap-2 transition text-sm md:text-base">
        <Icon icon="mdi:arrow-left" class="w-5 h-5" />
        Back
      </button>

      <div class="bg-white rounded-2xl shadow-sm p-4 md:p-6">
        <h1 class="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
          <Icon icon="mdi:truck-outline" class="w-6 h-6 text-green-600" />
          Post a Transport Request
        </h1>

        <div class="space-y-3 md:space-y-4">

          <!-- Pickup & Destination -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
              <input v-model="form.pickup_location" type="text" placeholder="e.g. Eldoret"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <input v-model="form.destination" type="text" placeholder="e.g. Nairobi"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          <!-- Cargo Type & Quantity -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Cargo Type</label>
              <input v-model="form.cargo_type" type="text" placeholder="e.g. Maize, Tomatoes"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input v-model="form.quantity" type="text" placeholder="e.g. 50 bags"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          <!-- Date & Time -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Preferred Date</label>
              <input v-model="form.preferred_date" type="date"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Preferred Time
                <span class="text-gray-400 font-normal">(optional)</span>
              </label>
              <input v-model="form.preferred_time" type="time"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          <!-- Budget & Phone -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Budget (KSh)
                <span class="text-gray-400 font-normal">(optional)</span>
              </label>
              <input v-model="form.budget" type="number" placeholder="e.g. 5000"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input v-model="form.contact_phone" type="tel" placeholder="e.g. 0712 345 678"
                class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>

          <button @click="submit" :disabled="loading"
            class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-semibold transition text-sm flex items-center justify-center gap-2">
            <Icon icon="mdi:truck-outline" class="w-6 h-6" />
            {{ loading ? 'Posting...' : 'Post Request' }}
          </button>

        </div>
      </div>
    </div>
  </div>
</template>