// middleware/auth.js
export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  const supabase = useSupabaseClient()

  if (!user.value) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      return navigateTo('/auth/login')
    }
  }
})