<script setup>
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const router = useRouter()

const { data: { user } } = await supabase.auth.getUser()

const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single()

const form = ref({
  name: profile?.name ?? '',
  phone: profile?.phone ?? '',
  location: profile?.location ?? '',
})

const loading = ref(false)
const error = ref('')
const success = ref(false)
const activeSection = ref('personal')

const counties = [
  'Nairobi', 'Nakuru', 'Eldoret', 'Kisumu', 'Mombasa',
  'Nyeri', 'Machakos', 'Kiambu', 'Meru', 'Kakamega',
  'Kisii', 'Kericho', 'Thika', 'Malindi', 'Garissa'
]

const hasChanged = computed(() => {
  return (
    form.value.name !== profile?.name ||
    form.value.phone !== profile?.phone ||
    form.value.location !== profile?.location
  )
})

const saveProfile = async () => {
  loading.value = true
  error.value = ''
  success.value = false

  try {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: form.value.name,
        phone: form.value.phone,
        location: form.value.location,
      })
      .eq('id', user.id)

    if (updateError) throw updateError
    success.value = true
    setTimeout(() => { success.value = false }, 3000)

  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-6xl mx-auto px-4">
      <div class="flex flex-col md:flex-row gap-6">

        <!-- Sidebar -->
        <div class="w-full md:w-72 shrink-0">
          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">

            <!-- Settings Header -->
            <div class="flex items-center gap-3 px-5 py-4 border-b">
              <button
                @click="router.back()"
                class="text-gray-500 hover:text-green-600 transition"
              >
                ←
              </button>
              <h2 class="font-bold text-gray-800">Settings</h2>
            </div>

            <!-- Menu sections -->
            <div class="divide-y divide-gray-100">

              <!-- Personal details -->
              <button
                @click="activeSection = 'personal'"
                class="w-full text-left px-5 py-4 text-sm font-semibold transition"
                :class="activeSection === 'personal'
                  ? 'text-green-600 bg-green-50'
                  : 'text-gray-700 hover:bg-gray-50'"
              >
                Personal details
              </button>

              <!-- Change phone -->
              <button
                @click="activeSection = 'phone'"
                class="w-full text-left px-5 py-4 text-sm transition"
                :class="activeSection === 'phone'
                  ? 'text-green-600 bg-green-50 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'"
              >
                Change phone number
              </button>

              <!-- Change email -->
              <button
                @click="activeSection = 'email'"
                class="w-full text-left px-5 py-4 text-sm transition"
                :class="activeSection === 'email'
                  ? 'text-green-600 bg-green-50 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'"
              >
                Change email
              </button>

              <!-- Change password -->
              <button
                @click="activeSection = 'password'"
                class="w-full text-left px-5 py-4 text-sm transition"
                :class="activeSection === 'password'
                  ? 'text-green-600 bg-green-50 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'"
              >
                Change password
              </button>

            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          <div class="bg-white rounded-2xl shadow-sm p-8">

            <!-- PERSONAL DETAILS -->
            <template v-if="activeSection === 'personal'">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-gray-800">Personal details</h2>
                <!-- Saved badge -->
                <span
                  v-if="success"
                  class="bg-green-100 text-green-700 text-sm px-4 py-1 rounded-full font-semibold"
                >
                  ✅ Saved
                </span>
              </div>

              <!-- Avatar -->
              <div class="flex justify-center mb-8">
                <div class="relative">
                  <div class="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center text-5xl">
                    👤
                  </div>
                  <button class="absolute bottom-0 right-0 bg-white border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center shadow text-sm hover:bg-gray-50">
                    ✏️
                  </button>
                </div>
              </div>

              <div class="max-w-md mx-auto space-y-5">

                <!-- Error -->
                <div v-if="error" class="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {{ error }}
                </div>

                <!-- Name -->
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">
                    Full Name *
                  </label>
                  <input
                    v-model="form.name"
                    type="text"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span class="absolute right-3 top-3 text-xs text-gray-400">
                    {{ form.name.length }} / 50
                  </span>
                </div>

                <!-- Phone -->
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">
                    Phone Number *
                  </label>
                  <input
                    v-model="form.phone"
                    type="tel"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <!-- Location -->
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">
                    Select Location *
                  </label>
                  <select
                    v-model="form.location"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
                  >
                    <option value="">Select your county</option>
                    <option v-for="county in counties" :key="county" :value="county">
                      {{ county }}
                    </option>
                  </select>
                </div>

                <!-- Save Button -->
                <button
                  @click="saveProfile"
                  :disabled="!hasChanged || loading"
                  class="w-full py-3 rounded-lg font-semibold transition"
                  :class="hasChanged
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'"
                >
                  {{ loading ? 'Saving...' : 'Save Changes' }}
                </button>

              </div>
            </template>

            <!-- CHANGE PHONE -->
            <template v-else-if="activeSection === 'phone'">
              <h2 class="text-xl font-bold text-gray-800 mb-6">Change phone number</h2>
              <div class="max-w-md mx-auto space-y-5">
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">
                    New Phone Number
                  </label>
                  <input
                    v-model="form.phone"
                    type="tel"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <button
                  @click="saveProfile"
                  class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
                >
                  {{ loading ? 'Saving...' : 'Update Phone' }}
                </button>
              </div>
            </template>

            <!-- CHANGE EMAIL -->
            <template v-else-if="activeSection === 'email'">
              <h2 class="text-xl font-bold text-gray-800 mb-6">Change email</h2>
              <div class="max-w-md mx-auto space-y-5">
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">
                    Current Email
                  </label>
                  <input
                    :value="user.email"
                    disabled
                    class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <p class="text-sm text-gray-400 text-center">
                  Email change coming soon
                </p>
              </div>
            </template>

            <!-- CHANGE PASSWORD -->
            <template v-else-if="activeSection === 'password'">
              <h2 class="text-xl font-bold text-gray-800 mb-6">Change password</h2>
              <div class="max-w-md mx-auto space-y-5">
                <p class="text-sm text-gray-500">
                  A password reset link will be sent to <strong>{{ user.email }}</strong>
                </p>
                <button
                  @click="async () => {
                    await supabase.auth.resetPasswordForEmail(user.email)
                    success = true
                  }"
                  class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
                >
                  Send Reset Link
                </button>
                <div v-if="success" class="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm text-center">
                  ✅ Reset link sent to your email!
                </div>
              </div>
            </template>

          </div>
        </div>

      </div>
    </div>
  </div>
</template>