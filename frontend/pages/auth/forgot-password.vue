<script setup>
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()

const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const sendResetLink = async () => {
  loading.value = true
  error.value = ''
  success.value = false

  if (!email.value) {
    error.value = 'Please enter your email address'
    loading.value = false
    return
  }

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.value, {
    redirectTo: 'http://localhost:3000/auth/reset-password'
  })

  if (resetError) {
    error.value = resetError.message
  } else {
    success.value = true
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
        <p class="text-gray-500 text-sm mt-1">Reset your password</p>
      </div>

      <!-- Success state -->
      <div v-if="success" class="text-center py-6">
        <div class="text-6xl mb-4">📧</div>
        <h3 class="font-bold text-gray-800 text-lg mb-2">Check your email!</h3>
        <p class="text-gray-500 text-sm mb-2">
          We sent a password reset link to:
        </p>
        <p class="font-semibold text-green-600 mb-6">{{ email }}</p>
        <p class="text-xs text-gray-400 mb-6">
          Didn't receive it? Check your spam folder or try again.
        </p>
        <button
          @click="success = false"
          class="text-green-600 hover:underline text-sm font-semibold"
        >
          Try again
        </button>
      </div>

      <!-- Form state -->
      <div v-else>

        <!-- Info box -->
        <div class="bg-blue-50 text-blue-700 text-sm px-4 py-3 rounded-lg mb-6 flex items-start gap-2">
          <span>ℹ️</span>
          <p>Enter your email address and we'll send you a link to reset your password.</p>
        </div>

        <!-- Error -->
        <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
          {{ error }}
        </div>

        <!-- Email input -->
        <div class="mb-6">
          <label class="text-sm text-gray-600 mb-1 block font-medium">Email Address</label>
          <input
            v-model="email"
            type="email"
            placeholder="your@email.com"
            @keyup.enter="sendResetLink"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <!-- Submit button -->
        <button
          @click="sendResetLink"
          :disabled="loading"
          class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
        >
          {{ loading ? 'Sending...' : 'Send Reset Link' }}
        </button>

        <!-- Back to login -->
        <p class="text-center text-sm text-gray-500 mt-6">
          Remember your password?
          <NuxtLink to="/auth/login" class="text-green-600 font-semibold hover:underline">
            Sign In
          </NuxtLink>
        </p>

      </div>

    </div>
  </div>
</template>