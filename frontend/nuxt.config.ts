export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/supabase'],
  css: ['~/assets/css/tailwind.css'],
  supabase: {
    redirect: false,
    cookieOptions: {
      maxAge: 60 * 60 * 8,
      sameSite: 'lax',
      secure: false
    }
  },
  runtimeConfig: {
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidEmail: process.env.VAPID_EMAIL,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    }
  },
  routeRules: {},
  vite: {
    optimizeDeps: {
      include: ['@iconify/vue']
    }
  }
})