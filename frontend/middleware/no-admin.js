export default defineNuxtRouteMiddleware(async (to) => {
  // Don't run on admin pages or listing view pages
  if (to.path.startsWith('/admin')) return
  if (to.path.startsWith('/listings/')) return

  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (profile?.is_admin) return navigateTo('/admin')
})