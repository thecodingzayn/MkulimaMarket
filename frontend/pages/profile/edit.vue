<script setup>
import { Icon } from '@iconify/vue'

definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const router = useRouter()

const { data: { user } } = await supabase.auth.getUser()

const { data: profile, refresh: refreshProfile } = await useAsyncData('profile', async () => {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  return data
})

const form = ref({
  name: profile.value?.name ?? '',
  phone: profile.value?.phone ?? '',
  location: profile.value?.location ?? '',
})

const avatarFile = ref(null)
const avatarPreview = ref(profile.value?.avatar_url ?? null)
const avatarLoading = ref(false)
const avatarInput = ref(null)

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
    form.value.name !== profile.value?.name ||
    form.value.phone !== profile.value?.phone ||
    form.value.location !== profile.value?.location ||
    avatarFile.value !== null
  )
})

const handleAvatarChange = (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'Image must be under 5MB'
    return
  }
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

const uploadAvatar = async () => {
  if (!avatarFile.value) return profile.value?.avatar_url ?? null

  const fileExt = avatarFile.value.name.split('.').pop()
  const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`

  // Delete old avatar if exists
  if (profile.value?.avatar_url) {
    const oldPath = profile.value.avatar_url.split('/product-images/')[1]
    if (oldPath) {
      await supabase.storage.from('product-images').remove([oldPath])
    }
  }

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, avatarFile.value, { upsert: true })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)
  return data.publicUrl
}

const saveProfile = async () => {
  loading.value = true
  error.value = ''
  success.value = false

  try {
    const avatarUrl = await uploadAvatar()

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: form.value.name,
        phone: form.value.phone,
        location: form.value.location,
        avatar_url: avatarUrl,
      })
      .eq('id', user.id)

    if (updateError) throw updateError

    avatarFile.value = null
    await refreshProfile()
    success.value = true
    setTimeout(() => { success.value = false }, 3000)

  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const removeAvatar = async () => {
  if (!profile.value?.avatar_url) return
  avatarLoading.value = true
  try {
    const oldPath = profile.value.avatar_url.split('/product-images/')[1]
    if (oldPath) {
      await supabase.storage.from('product-images').remove([oldPath])
    }
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    avatarPreview.value = null
    avatarFile.value = null
    await refreshProfile()
  } catch (err) {
    error.value = err.message
  } finally {
    avatarLoading.value = false
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
            <div class="flex items-center gap-3 px-5 py-4 border-b">
              <button @click="router.back()" class="text-gray-500 hover:text-green-600 transition">
                <Icon icon="mdi:arrow-left" class="w-5 h-5" />
              </button>
              <h2 class="font-bold text-gray-800">Settings</h2>
            </div>
            <div class="divide-y divide-gray-100">
              <button @click="activeSection = 'personal'"
                class="w-full text-left px-5 py-4 text-sm font-semibold transition flex items-center gap-3"
                :class="activeSection === 'personal' ? 'text-green-600 bg-green-50' : 'text-gray-700 hover:bg-gray-50'">
                <Icon icon="mdi:account-outline" class="w-4 h-4 shrink-0" />
                Personal details
              </button>
              <button @click="activeSection = 'phone'"
                class="w-full text-left px-5 py-4 text-sm transition flex items-center gap-3"
                :class="activeSection === 'phone' ? 'text-green-600 bg-green-50 font-semibold' : 'text-gray-700 hover:bg-gray-50'">
                <Icon icon="mdi:phone-outline" class="w-4 h-4 shrink-0" />
                Change phone number
              </button>
              <button @click="activeSection = 'email'"
                class="w-full text-left px-5 py-4 text-sm transition flex items-center gap-3"
                :class="activeSection === 'email' ? 'text-green-600 bg-green-50 font-semibold' : 'text-gray-700 hover:bg-gray-50'">
                <Icon icon="mdi:email-outline" class="w-4 h-4 shrink-0" />
                Change email
              </button>
              <button @click="activeSection = 'password'"
                class="w-full text-left px-5 py-4 text-sm transition flex items-center gap-3"
                :class="activeSection === 'password' ? 'text-green-600 bg-green-50 font-semibold' : 'text-gray-700 hover:bg-gray-50'">
                <Icon icon="mdi:lock-outline" class="w-4 h-4 shrink-0" />
                Change password
              </button>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          <div class="bg-white rounded-2xl shadow-sm p-6 md:p-8">

            <!-- PERSONAL DETAILS -->
            <template v-if="activeSection === 'personal'">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-gray-800">Personal details</h2>
                <span v-if="success"
                  class="bg-green-100 text-green-700 text-sm px-4 py-1 rounded-full font-semibold flex items-center gap-1">
                  <Icon icon="mdi:check-circle" class="w-4 h-4" />
                  Saved
                </span>
              </div>

              <!-- Avatar section -->
              <div class="flex flex-col items-center mb-8">
                <div class="relative group">
                  <!-- Avatar image or placeholder -->
                  <div class="w-28 h-28 rounded-full overflow-hidden bg-green-100 flex items-center justify-center border-4 border-white shadow-md">
                    <img v-if="avatarPreview" :src="avatarPreview"
                      class="w-full h-full object-cover" />
                    <Icon v-else icon="mdi:account" class="w-16 h-16 text-green-400" />
                  </div>

                  <!-- Edit overlay -->
                  <label
                    class="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center cursor-pointer transition-all">
                    <Icon icon="mdi:camera" class="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    <input ref="avatarInput" type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />
                  </label>
                </div>

                <!-- Action buttons below avatar -->
                <div class="flex items-center gap-3 mt-3">
                  <label
                    class="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium cursor-pointer transition">
                    <Icon icon="mdi:camera-outline" class="w-4 h-4" />
                    {{ avatarPreview ? 'Change photo' : 'Upload photo' }}
                    <input type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />
                  </label>
                  <span v-if="profile?.avatar_url || avatarPreview" class="text-gray-300">·</span>
                  <button v-if="profile?.avatar_url || avatarPreview"
                    @click="removeAvatar"
                    :disabled="avatarLoading"
                    class="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-500 font-medium transition disabled:opacity-50">
                    <Icon icon="mdi:delete-outline" class="w-4 h-4" />
                    {{ avatarLoading ? 'Removing...' : 'Remove' }}
                  </button>
                </div>
                <p class="text-xs text-gray-400 mt-1">JPG or PNG, max 5MB</p>
              </div>

              <div class="max-w-md mx-auto space-y-5">

                <div v-if="error" class="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <Icon icon="mdi:alert-circle" class="w-4 h-4 shrink-0" />
                  {{ error }}
                </div>

                <!-- Name -->
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">
                    Full Name
                  </label>
                  <input v-model="form.name" type="text"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <span class="absolute right-3 top-3 text-xs text-gray-400">
                    {{ form.name.length }} / 50
                  </span>
                </div>

                <!-- Phone -->
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">
                    Phone Number
                  </label>
                  <input v-model="form.phone" type="tel"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>

                <!-- Location -->
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">
                    Location
                  </label>
                  <select v-model="form.location"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none">
                    <option value="">Select your county</option>
                    <option v-for="county in counties" :key="county" :value="county">{{ county }}</option>
                  </select>
                </div>

                <!-- Save -->
                <button @click="saveProfile" :disabled="!hasChanged || loading"
                  class="w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  :class="hasChanged ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'">
                  <Icon v-if="loading" icon="mdi:loading" class="w-5 h-5 animate-spin" />
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
                  <input v-model="form.phone" type="tel"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <button @click="saveProfile"
                  class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                  <Icon v-if="loading" icon="mdi:loading" class="w-5 h-5 animate-spin" />
                  {{ loading ? 'Saving...' : 'Update Phone' }}
                </button>
                <div v-if="success" class="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm text-center flex items-center justify-center gap-2">
                  <Icon icon="mdi:check-circle" class="w-4 h-4" />
                  Phone number updated!
                </div>
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
                  <input :value="user.email" disabled
                    class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
                </div>
                <p class="text-sm text-gray-400 text-center">Email change coming soon.</p>
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
                  class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                  <Icon icon="mdi:email-outline" class="w-4 h-4" />
                  Send Reset Link
                </button>
                <div v-if="success" class="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm text-center flex items-center justify-center gap-2">
                  <Icon icon="mdi:check-circle" class="w-4 h-4" />
                  Reset link sent to your email!
                </div>
              </div>
            </template>

          </div>
        </div>

      </div>
    </div>
  </div>
</template>