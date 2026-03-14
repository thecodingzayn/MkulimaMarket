<script setup>
const props = defineProps({
  modelValue: Boolean,
  listing: Object,
  user: Object,
})
const emit = defineEmits(['update:modelValue', 'boosted'])

const supabase = useSupabaseClient()
const phone = ref('')
const selectedTier = ref(null)
const step = ref('select') // select → confirm → processing → success → failed
const checkoutRequestId = ref(null)
const pollInterval = ref(null)
const error = ref('')

const tiers = [
  { days: 3, amount: 1, label: '3 Days', description: 'Quick boost' },
  { days: 7, amount: 100, label: '7 Days', description: 'Most popular' },
  { days: 14, amount: 200, label: '14 Days', description: 'Best value' },
]

const close = () => {
  if (pollInterval.value) clearInterval(pollInterval.value)
  step.value = 'select'
  selectedTier.value = null
  phone.value = ''
  error.value = ''
  emit('update:modelValue', false)
}

const initiatePay = async () => {
  if (!selectedTier.value) { error.value = 'Please select a boost plan'; return }
  if (!phone.value) { error.value = 'Please enter your M-Pesa phone number'; return }
  error.value = ''
  step.value = 'processing'

  try {
    const res = await $fetch('/api/mpesa/stkpush', {
      method: 'POST',
      body: {
        phone: phone.value,
        amount: selectedTier.value.amount,
        days: selectedTier.value.days,
        productId: props.listing.id,
        userId: props.user.id,
      }
    })

    checkoutRequestId.value = res.checkoutRequestId
    step.value = 'confirm'
    startPolling()
  } catch (err) {
    error.value = err.data?.message ?? 'Payment initiation failed'
    step.value = 'select'
  }
}

const startPolling = () => {
  let attempts = 0
  pollInterval.value = setInterval(async () => {
    attempts++
    if (attempts > 30) {
      clearInterval(pollInterval.value)
      step.value = 'failed'
      return
    }

    const res = await $fetch(`/api/mpesa/status?checkoutRequestId=${checkoutRequestId.value}`)

    if (res.status === 'confirmed') {
      clearInterval(pollInterval.value)
      step.value = 'success'
      emit('boosted')
    } else if (res.status === 'failed') {
      clearInterval(pollInterval.value)
      step.value = 'failed'
    }
  }, 3000)
}
</script>

<template>
  <div v-if="modelValue"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
    @click.self="close">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

      <!-- Header -->
      <div class="flex justify-between items-center mb-5">
        <h3 class="font-bold text-gray-800 text-lg">🔥 Boost Listing</h3>
        <button @click="close" class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
      </div>

      <!-- Listing preview -->
      <div class="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mb-5">
        <div class="w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100">
          <img v-if="listing?.image_url" :src="listing.image_url" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-xl">🌾</div>
        </div>
        <div>
          <p class="font-semibold text-gray-800 text-sm truncate">{{ listing?.title }}</p>
          <p class="text-green-600 text-sm font-bold">KSh {{ listing?.price }}</p>
        </div>
      </div>

      <!-- Step: Select tier -->
      <template v-if="step === 'select'">
        <p class="text-sm text-gray-500 mb-4">Choose a boost plan to appear at the top of search results:</p>

        <div class="space-y-3 mb-5">
          <div v-for="tier in tiers" :key="tier.days"
            @click="selectedTier = tier"
            class="border-2 rounded-xl p-4 cursor-pointer transition"
            :class="selectedTier?.days === tier.days
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-green-300'">
            <div class="flex justify-between items-center">
              <div>
                <p class="font-semibold text-gray-800">{{ tier.label }}</p>
                <p class="text-xs text-gray-400">{{ tier.description }}</p>
              </div>
              <p class="font-bold text-green-600 text-lg">KSh {{ tier.amount }}</p>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <label class="text-sm font-semibold text-gray-700 mb-1 block">M-Pesa Phone Number</label>
          <input v-model="phone" type="tel" placeholder="e.g. 0712345678"
            class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <p class="text-xs text-gray-400 mt-1">You'll receive an M-Pesa prompt on this number</p>
        </div>

        <p v-if="error" class="text-red-500 text-sm mb-3">{{ error }}</p>

        <button @click="initiatePay"
          class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition">
          Pay KSh {{ selectedTier?.amount ?? '—' }} via M-Pesa
        </button>
      </template>

      <!-- Step: Confirm (waiting for user to accept prompt) -->
      <template v-else-if="step === 'confirm'">
        <div class="text-center py-6">
          <div class="text-5xl mb-4">📱</div>
          <p class="font-bold text-gray-800 text-lg mb-2">Check your phone!</p>
          <p class="text-sm text-gray-500 mb-1">An M-Pesa prompt has been sent to</p>
          <p class="font-semibold text-gray-700 mb-4">{{ phone }}</p>
          <div class="flex items-center justify-center gap-2 text-green-600">
            <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span class="text-sm">Waiting for payment confirmation...</span>
          </div>
          <p class="text-xs text-gray-400 mt-4">Enter your M-Pesa PIN to complete payment</p>
        </div>
      </template>

      <!-- Step: Processing -->
      <template v-else-if="step === 'processing'">
        <div class="text-center py-6">
          <div class="text-5xl mb-4">⏳</div>
          <p class="font-bold text-gray-800">Initiating payment...</p>
          <p class="text-sm text-gray-400 mt-2">Please wait</p>
        </div>
      </template>

      <!-- Step: Success -->
      <template v-else-if="step === 'success'">
        <div class="text-center py-6">
          <div class="text-5xl mb-4">🎉</div>
          <p class="font-bold text-gray-800 text-lg mb-2">Listing Boosted!</p>
          <p class="text-sm text-gray-500 mb-1">Your listing is now featured for</p>
          <p class="font-bold text-green-600 text-xl mb-4">{{ selectedTier?.days }} days</p>
          <p class="text-xs text-gray-400 mb-5">It will appear at the top of search results with a 🔥 badge</p>
          <button @click="close"
            class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition">
            Done
          </button>
        </div>
      </template>

      <!-- Step: Failed -->
      <template v-else-if="step === 'failed'">
        <div class="text-center py-6">
          <div class="text-5xl mb-4">❌</div>
          <p class="font-bold text-gray-800 text-lg mb-2">Payment Failed</p>
          <p class="text-sm text-gray-500 mb-5">The payment was not completed. Please try again.</p>
          <button @click="step = 'select'"
            class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition">
            Try Again
          </button>
        </div>
      </template>

    </div>
  </div>
</template>