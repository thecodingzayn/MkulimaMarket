<script setup>
import { Icon } from '@iconify/vue'

definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const router = useRouter()
const route = useRoute()

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
const activeSection = ref(route.query.section ?? 'personal')

// Verification form
const verificationForm = ref({
  full_name: profile.value?.name ?? '',
  phone: profile.value?.phone ?? '',
  id_number: '',
  business_name: '',
  county: profile.value?.location ?? '',
  reason: '',
})
const verificationLoading = ref(false)
const verificationSuccess = ref(false)
const verificationError = ref('')

const { data: verificationRequest, refresh: refreshVerification } = await useAsyncData(
  'verification-request',
  async () => {
    const { data } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    return data
  },
  { default: () => null }
)

// Use profile.verification_status as source of truth
const verificationStatus = computed(() => profile.value?.verification_status ?? 'none')

const submitVerification = async () => {
  verificationLoading.value = true
  verificationError.value = ''
  verificationSuccess.value = false
  try {
    const { error: err } = await supabase
      .from('verification_requests')
      .upsert({
        user_id: user.id,
        full_name: verificationForm.value.full_name,
        phone: verificationForm.value.phone,
        id_number: verificationForm.value.id_number,
        business_name: verificationForm.value.business_name || null,
        county: verificationForm.value.county,
        reason: verificationForm.value.reason,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (err) throw err

    await supabase.from('profiles')
      .update({
        verification_status: 'pending',
        verification_requested_at: new Date().toISOString()
      })
      .eq('id', user.id)

    verificationSuccess.value = true
    await refreshVerification()
    await refreshProfile()
  } catch (err) {
    verificationError.value = err.message
  } finally {
    verificationLoading.value = false
  }
}

const counties = [
  'Nairobi', 'Nakuru', 'Eldoret', 'Kisumu', 'Mombasa',
  'Nyeri', 'Machakos', 'Kiambu', 'Meru', 'Kakamega',
  'Kisii', 'Kericho', 'Thika', 'Malindi', 'Garissa'
]

const hasChanged = computed(() =>
  form.value.name !== profile.value?.name ||
  form.value.phone !== profile.value?.phone ||
  form.value.location !== profile.value?.location ||
  avatarFile.value !== null
)

const handleAvatarChange = (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) { error.value = 'Image must be under 5MB'; return }
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

const uploadAvatar = async () => {
  if (!avatarFile.value) return profile.value?.avatar_url ?? null
  const fileExt = avatarFile.value.name.split('.').pop()
  const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`
  if (profile.value?.avatar_url) {
    const oldPath = profile.value.avatar_url.split('/product-images/')[1]
    if (oldPath) await supabase.storage.from('product-images').remove([oldPath])
  }
  const { error: uploadError } = await supabase.storage
    .from('product-images').upload(fileName, avatarFile.value, { upsert: true })
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
      .update({ name: form.value.name, phone: form.value.phone, location: form.value.location, avatar_url: avatarUrl })
      .eq('id', user.id)
    if (updateError) throw updateError
    avatarFile.value = null
    await refreshProfile()
    success.value = true
    setTimeout(() => { success.value = false }, 3000)
  } catch (err) { error.value = err.message }
  finally { loading.value = false }
}

const removeAvatar = async () => {
  if (!profile.value?.avatar_url) return
  avatarLoading.value = true
  try {
    const oldPath = profile.value.avatar_url.split('/product-images/')[1]
    if (oldPath) await supabase.storage.from('product-images').remove([oldPath])
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    avatarPreview.value = null
    avatarFile.value = null
    await refreshProfile()
  } catch (err) { error.value = err.message }
  finally { avatarLoading.value = false }
}

const sections = [
  { key: 'personal', label: 'Personal details', icon: 'mdi:account-outline' },
  { key: 'phone', label: 'Change phone number', icon: 'mdi:phone-outline' },
  { key: 'email', label: 'Change email', icon: 'mdi:email-outline' },
  { key: 'password', label: 'Change password', icon: 'mdi:lock-outline' },
  { key: 'verification', label: 'Seller Verification', icon: 'mdi:check-decagram' },
]
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
              <button v-for="s in sections" :key="s.key"
                @click="activeSection = s.key"
                class="w-full text-left px-5 py-4 text-sm transition flex items-center gap-3"
                :class="activeSection === s.key ? 'text-green-600 bg-green-50 font-semibold' : 'text-gray-700 hover:bg-gray-50'">
                <Icon :icon="s.icon" class="w-4 h-4 shrink-0" />
                <span class="flex-1">{{ s.label }}</span>
                <Icon v-if="s.key === 'verification' && profile?.is_verified"
                  icon="mdi:check-decagram" class="w-4 h-4 text-blue-500 shrink-0" />
                <span v-else-if="s.key === 'verification' && verificationStatus === 'pending'"
                  class="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                  Pending
                </span>
                <span v-else-if="s.key === 'verification' && verificationStatus === 'rejected'"
                  class="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                  Rejected
                </span>
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
                  <Icon icon="mdi:check-circle" class="w-4 h-4" />Saved
                </span>
              </div>

              <div class="flex flex-col items-center mb-8">
                <div class="relative group">
                  <div class="w-28 h-28 rounded-full overflow-hidden bg-green-100 flex items-center justify-center border-4 border-white shadow-md">
                    <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" />
                    <Icon v-else icon="mdi:account" class="w-16 h-16 text-green-400" />
                  </div>
                  <!-- Verified badge on avatar -->
                  <div v-if="profile?.is_verified"
                    class="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow"
                    title="Verified Seller">
                    <Icon icon="mdi:check" class="w-4 h-4 text-white" />
                  </div>
                  <label class="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center cursor-pointer transition-all">
                    <Icon icon="mdi:camera" class="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    <input ref="avatarInput" type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />
                  </label>
                </div>
                <div class="flex items-center gap-3 mt-3">
                  <label class="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium cursor-pointer transition">
                    <Icon icon="mdi:camera-outline" class="w-4 h-4" />
                    {{ avatarPreview ? 'Change photo' : 'Upload photo' }}
                    <input type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />
                  </label>
                  <span v-if="profile?.avatar_url || avatarPreview" class="text-gray-300">·</span>
                  <button v-if="profile?.avatar_url || avatarPreview"
                    @click="removeAvatar" :disabled="avatarLoading"
                    class="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-500 font-medium transition disabled:opacity-50">
                    <Icon icon="mdi:delete-outline" class="w-4 h-4" />
                    {{ avatarLoading ? 'Removing...' : 'Remove' }}
                  </button>
                </div>
                <p class="text-xs text-gray-400 mt-1">JPG or PNG, max 5MB</p>
              </div>

              <div class="max-w-md mx-auto space-y-5">
                <div v-if="error" class="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <Icon icon="mdi:alert-circle" class="w-4 h-4 shrink-0" />{{ error }}
                </div>
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Full Name</label>
                  <input v-model="form.name" type="text"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <span class="absolute right-3 top-3 text-xs text-gray-400">{{ form.name.length }} / 50</span>
                </div>
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Phone Number</label>
                  <input v-model="form.phone" type="tel"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Location</label>
                  <select v-model="form.location"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none">
                    <option value="">Select your county</option>
                    <option v-for="county in counties" :key="county" :value="county">{{ county }}</option>
                  </select>
                </div>
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
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">New Phone Number</label>
                  <input v-model="form.phone" type="tel"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <button @click="saveProfile"
                  class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                  <Icon v-if="loading" icon="mdi:loading" class="w-5 h-5 animate-spin" />
                  {{ loading ? 'Saving...' : 'Update Phone' }}
                </button>
                <div v-if="success" class="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm text-center flex items-center justify-center gap-2">
                  <Icon icon="mdi:check-circle" class="w-4 h-4" />Phone number updated!
                </div>
              </div>
            </template>

            <!-- CHANGE EMAIL -->
            <template v-else-if="activeSection === 'email'">
              <h2 class="text-xl font-bold text-gray-800 mb-6">Change email</h2>
              <div class="max-w-md mx-auto space-y-5">
                <div class="relative">
                  <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Current Email</label>
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
                <button @click="async () => { await supabase.auth.resetPasswordForEmail(user.email); success = true }"
                  class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                  <Icon icon="mdi:email-outline" class="w-4 h-4" />Send Reset Link
                </button>
                <div v-if="success" class="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm text-center flex items-center justify-center gap-2">
                  <Icon icon="mdi:check-circle" class="w-4 h-4" />Reset link sent to your email!
                </div>
              </div>
            </template>

            <!-- SELLER VERIFICATION -->
            <template v-else-if="activeSection === 'verification'">
              <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Icon icon="mdi:check-decagram" class="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h2 class="text-xl font-bold text-gray-800">Seller Verification</h2>
                  <p class="text-sm text-gray-500">Get a verified badge on your profile and listings</p>
                </div>
              </div>

              <!-- ✅ VERIFIED -->
              <div v-if="profile?.is_verified"
                class="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                <Icon icon="mdi:check-decagram" class="w-14 h-14 text-blue-500 mx-auto mb-3" />
                <h3 class="font-bold text-blue-800 text-lg mb-1">You are a Verified Seller!</h3>
                <p class="text-blue-600 text-sm">Your profile and listings now show a verified badge.</p>
                <p v-if="profile?.verified_at" class="text-xs text-blue-400 mt-2">
                  Verified on {{ new Date(profile.verified_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) }}
                </p>
              </div>

              <!-- ❌ REJECTED — show rejection notice + reapply form -->
              <template v-else-if="verificationStatus === 'rejected'">
                <div class="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
                  <div class="flex items-start gap-3">
                    <Icon icon="mdi:close-circle" class="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p class="font-semibold text-red-700 text-sm">Your verification was not approved</p>
                      <p v-if="verificationRequest?.admin_note" class="text-xs text-red-500 mt-0.5">
                        Reason: {{ verificationRequest.admin_note }}
                      </p>
                      <p class="text-xs text-red-400 mt-1">You may reapply below.</p>
                    </div>
                  </div>
                </div>

                <!-- Benefits -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div class="bg-blue-50 rounded-xl p-3 text-center">
                    <Icon icon="mdi:check-decagram" class="w-6 h-6 text-blue-500 mx-auto mb-1" />
                    <p class="text-xs font-semibold text-blue-700">Verified Badge</p>
                    <p class="text-xs text-blue-500 mt-0.5">On profile & listings</p>
                  </div>
                  <div class="bg-green-50 rounded-xl p-3 text-center">
                    <Icon icon="mdi:trending-up" class="w-6 h-6 text-green-500 mx-auto mb-1" />
                    <p class="text-xs font-semibold text-green-700">More Visibility</p>
                    <p class="text-xs text-green-500 mt-0.5">Buyers trust verified sellers</p>
                  </div>
                  <div class="bg-purple-50 rounded-xl p-3 text-center">
                    <Icon icon="mdi:shield-check" class="w-6 h-6 text-purple-500 mx-auto mb-1" />
                    <p class="text-xs font-semibold text-purple-700">Trusted Seller</p>
                    <p class="text-xs text-purple-500 mt-0.5">Stand out from others</p>
                  </div>
                </div>

                <div v-if="verificationSuccess"
                  class="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
                  <Icon icon="mdi:check-circle" class="w-4 h-4" />
                  Application resubmitted! We'll review and notify you soon.
                </div>
                <div v-if="verificationError"
                  class="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-5 flex items-center gap-2 text-sm">
                  <Icon icon="mdi:alert-circle" class="w-4 h-4 shrink-0" />{{ verificationError }}
                </div>

                <div class="space-y-4 max-w-lg">
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Full Name *</label>
                    <input v-model="verificationForm.full_name" type="text"
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Phone Number *</label>
                    <input v-model="verificationForm.phone" type="tel"
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">National ID Number *</label>
                    <input v-model="verificationForm.id_number" type="text"
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Business Name (optional)</label>
                    <input v-model="verificationForm.business_name" type="text"
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">County *</label>
                    <select v-model="verificationForm.county"
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                      <option value="">Select your county</option>
                      <option v-for="county in counties" :key="county" :value="county">{{ county }}</option>
                    </select>
                  </div>
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Why do you want to be verified? *</label>
                    <textarea v-model="verificationForm.reason" rows="3"
                      placeholder="Tell us about your farming business..."
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <button @click="submitVerification"
                    :disabled="verificationLoading || !verificationForm.full_name || !verificationForm.id_number || !verificationForm.county || !verificationForm.reason"
                    class="w-full py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 text-sm"
                    :class="verificationForm.full_name && verificationForm.id_number && verificationForm.county && verificationForm.reason
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'">
                    <Icon v-if="verificationLoading" icon="mdi:loading" class="w-4 h-4 animate-spin" />
                    <Icon v-else icon="mdi:check-decagram" class="w-4 h-4" />
                    {{ verificationLoading ? 'Submitting...' : 'Resubmit Verification Request' }}
                  </button>
                </div>
              </template>

              <!-- ⏳ PENDING -->
              <div v-else-if="verificationStatus === 'pending'"
                class="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
                <Icon icon="mdi:clock-outline" class="w-14 h-14 text-orange-400 mx-auto mb-3" />
                <h3 class="font-bold text-orange-800 text-lg mb-1">Application Under Review</h3>
                <p class="text-orange-600 text-sm">Your verification request is being reviewed. We'll notify you once approved.</p>
                <p v-if="verificationRequest?.created_at" class="text-xs text-orange-400 mt-2">
                  Submitted {{ new Date(verificationRequest.created_at).toLocaleDateString('en-KE') }}
                </p>
              </div>

              <!-- 📝 NO APPLICATION YET -->
              <template v-else>
                <!-- Benefits -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div class="bg-blue-50 rounded-xl p-3 text-center">
                    <Icon icon="mdi:check-decagram" class="w-6 h-6 text-blue-500 mx-auto mb-1" />
                    <p class="text-xs font-semibold text-blue-700">Verified Badge</p>
                    <p class="text-xs text-blue-500 mt-0.5">On profile & listings</p>
                  </div>
                  <div class="bg-green-50 rounded-xl p-3 text-center">
                    <Icon icon="mdi:trending-up" class="w-6 h-6 text-green-500 mx-auto mb-1" />
                    <p class="text-xs font-semibold text-green-700">More Visibility</p>
                    <p class="text-xs text-green-500 mt-0.5">Buyers trust verified sellers</p>
                  </div>
                  <div class="bg-purple-50 rounded-xl p-3 text-center">
                    <Icon icon="mdi:shield-check" class="w-6 h-6 text-purple-500 mx-auto mb-1" />
                    <p class="text-xs font-semibold text-purple-700">Trusted Seller</p>
                    <p class="text-xs text-purple-500 mt-0.5">Stand out from others</p>
                  </div>
                </div>

                <div v-if="verificationSuccess"
                  class="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
                  <Icon icon="mdi:check-circle" class="w-4 h-4" />
                  Application submitted! We'll review and notify you soon.
                </div>
                <div v-if="verificationError"
                  class="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-5 flex items-center gap-2 text-sm">
                  <Icon icon="mdi:alert-circle" class="w-4 h-4 shrink-0" />{{ verificationError }}
                </div>

                <div class="space-y-4 max-w-lg">
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Full Name *</label>
                    <input v-model="verificationForm.full_name" type="text"
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Phone Number *</label>
                    <input v-model="verificationForm.phone" type="tel"
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">National ID Number *</label>
                    <input v-model="verificationForm.id_number" type="text"
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Business Name (optional)</label>
                    <input v-model="verificationForm.business_name" type="text"
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">County *</label>
                    <select v-model="verificationForm.county"
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                      <option value="">Select your county</option>
                      <option v-for="county in counties" :key="county" :value="county">{{ county }}</option>
                    </select>
                  </div>
                  <div class="relative">
                    <label class="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500">Why do you want to be verified? *</label>
                    <textarea v-model="verificationForm.reason" rows="3"
                      placeholder="Tell us about your farming business and why you'd like to be verified..."
                      class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <p class="text-xs text-gray-400 flex items-start gap-1.5">
                    <Icon icon="mdi:information-outline" class="w-4 h-4 shrink-0 mt-0.5" />
                    Your information is kept private and only used for verification purposes.
                  </p>
                  <button @click="submitVerification"
                    :disabled="verificationLoading || !verificationForm.full_name || !verificationForm.id_number || !verificationForm.county || !verificationForm.reason"
                    class="w-full py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 text-sm"
                    :class="verificationForm.full_name && verificationForm.id_number && verificationForm.county && verificationForm.reason
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'">
                    <Icon v-if="verificationLoading" icon="mdi:loading" class="w-4 h-4 animate-spin" />
                    <Icon v-else icon="mdi:check-decagram" class="w-4 h-4" />
                    {{ verificationLoading ? 'Submitting...' : 'Submit Verification Request' }}
                  </button>
                </div>
              </template>

            </template>

          </div>
        </div>

      </div>
    </div>
  </div>
</template>