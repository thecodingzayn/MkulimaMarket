<script setup>
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const router = useRouter()

const form = ref({
  email: '',
  password: '',
})

const loading = ref(false)
const error = ref('')

const login = async () => {
  loading.value = true
  error.value = ''

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: form.value.email,
    password: form.value.password,
  })

  if (signInError) {
    error.value = signInError.message
    loading.value = false
    return
  }

  router.push('/')
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="bg-white rounded-2xl shadow-md p-8 w-full max-w-md">

      <!-- Logo -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-green-600">MkulimaMarket</h1>
        <p class="text-gray-500 text-sm mt-1">Welcome back</p>
      </div>

      <!-- Error -->
      <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
        {{ error }}
      </div>

      <!-- Form -->
      <div class="space-y-4">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">Email</label>
          <input
            v-model="form.email"
            type="email"
            placeholder="john@email.com"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label class="text-sm text-gray-600 mb-1 block">Password</label>
          <input
            v-model="form.password"
            type="password"
            placeholder="Your password"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <!-- Forgot password -->
        <div class="text-right">
          <NuxtLink to="/auth/forgot-password" class="text-sm text-green-600 hover:underline">
            Forgot password?
          </NuxtLink>
        </div>

        <button
          @click="login"
          :disabled="loading"
          class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
        >
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </div>

      <!-- Register link -->
      <p class="text-center text-sm text-gray-500 mt-6">
        Don't have an account?
        <NuxtLink to="/auth/register" class="text-green-600 font-semibold hover:underline">
          Register
        </NuxtLink>
      </p>

    </div>
  </div>
</template>