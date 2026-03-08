<script setup>
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const router = useRouter()

const form = ref({
  password: '',
  confirmPassword: ''
})

const loading = ref(false)
const error = ref('')
const success = ref(false)

const resetPassword = async () => {
  loading.value = true
  error.value = ''

  if (form.value.password !== form.value.confirmPassword) {
    error.value = 'Passwords do not match'
    loading.value = false
    return
  }

  if (form.value.password.length < 6) {
    error.value = 'Password must be at least 6 characters'
    loading.value = false
    return
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: form.value.password
  })

  if (updateError) {
    error.value = updateError.message
  } else {
    success.value = true
    setTimeout(() => {
      router.push('/auth/login')
    }, 2000)
  }

  loading.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="bg-white rounded-2xl shadow-md p-8 w-full max-w-md">

      <!-- Logo -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-green-600">MkulimaMarket</h1>
        <p class="text-gray-500 text-sm mt-1">Create a new password</p>
      </div>

      <!-- Success -->
      <div v-if="success" class="text-center py-6">
        <div class="text-6xl mb-4">✅</div>
        <h3 class="font-bold text-gray-800 text-lg mb-2">Password updated!</h3>
        <p class="text-gray-500 text-sm">Redirecting to login...</p>
      </div>

      <!-- Form -->
      <div v-else class="space-y-4">

        <!-- Error -->
        <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
          {{ error }}
        </div>

        <!-- New password -->
        <div>
          <label class="text-sm text-gray-600 mb-1 block font-medium">New Password</label>
          <input
            v-model="form.password"
            type="password"
            placeholder="Min 6 characters"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <!-- Confirm password -->
        <div>
          <label class="text-sm text-gray-600 mb-1 block font-medium">Confirm Password</label>
          <input
            v-model="form.confirmPassword"
            type="password"
            placeholder="Repeat your password"
            @keyup.enter="resetPassword"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <button
          @click="resetPassword"
          :disabled="loading"
          class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
        >
          {{ loading ? 'Updating...' : 'Update Password' }}
        </button>

        <p class="text-center text-sm text-gray-500">
          <NuxtLink to="/auth/login" class="text-green-600 font-semibold hover:underline">
            Back to Sign In
          </NuxtLink>
        </p>

      </div>

    </div>
  </div>
</template>