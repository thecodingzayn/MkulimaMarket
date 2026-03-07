<script setup>
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const router = useRouter()

const form = ref({
  name: '',
  email: '',
  phone: '',
  location: '',
  password: '',
})

const loading = ref(false)
const error = ref('')

const register = async () => {
  loading.value = true
  error.value = ''

  const { data, error: signUpError } = await supabase.auth.signUp({
    email: form.value.email,
    password: form.value.password,
    options: {
      data: {
        name: form.value.name,
        phone: form.value.phone,
        location: form.value.location,
      }
    }
  })

  if (signUpError) {
    error.value = signUpError.message
    loading.value = false
    return
  }

  // Update profile with extra info
  await supabase.from('profiles').upsert({
    id: data.user.id,
    name: form.value.name,
    phone: form.value.phone,
    location: form.value.location,
  })

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
        <p class="text-gray-500 text-sm mt-1">Create your account</p>
      </div>

      <!-- Error -->
      <div v-if="error" class="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
        {{ error }}
      </div>

      <!-- Form -->
      <div class="space-y-4">
        <div>
          <label class="text-sm text-gray-600 mb-1 block">Full Name</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="John Kamau"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

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
          <label class="text-sm text-gray-600 mb-1 block">Phone Number</label>
          <input
            v-model="form.phone"
            type="tel"
            placeholder="07XX XXX XXX"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label class="text-sm text-gray-600 mb-1 block">Location</label>
          <select
            v-model="form.location"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select your county</option>
            <option>Nairobi</option>
            <option>Nakuru</option>
            <option>Eldoret</option>
            <option>Kisumu</option>
            <option>Mombasa</option>
            <option>Nyeri</option>
            <option>Machakos</option>
            <option>Kiambu</option>
          </select>
        </div>

        <div>
          <label class="text-sm text-gray-600 mb-1 block">Password</label>
          <input
            v-model="form.password"
            type="password"
            placeholder="Min 6 characters"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <button
          @click="register"
          :disabled="loading"
          class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
        >
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>
      </div>

      <!-- Login link -->
      <p class="text-center text-sm text-gray-500 mt-6">
        Already have an account?
        <NuxtLink to="/auth/login" class="text-green-600 font-semibold hover:underline">
          Sign In
        </NuxtLink>
      </p>

    </div>
  </div>
</template>