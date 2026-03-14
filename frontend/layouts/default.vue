<script setup>
const supabase = useSupabaseClient()
const route = useRoute()

const isAdmin = ref(false)

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  isAdmin.value = profile?.is_admin ?? false
})
</script>

<template>
  <div>
    <Navbar v-if="!isAdmin" />
    <slot />
  </div>
</template>