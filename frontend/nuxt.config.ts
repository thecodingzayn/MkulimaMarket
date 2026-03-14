export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/supabase'],
  css: ['~/assets/css/tailwind.css'],
  supabase: { redirect: false, cookieOptions: { maxAge: 60 * 60 * 8, sameSite: 'lax', secure: false } },
  runtimeConfig: {
    mpesaConsumerKey: process.env.MPESA_CONSUMER_KEY,
    mpesaConsumerSecret: process.env.MPESA_CONSUMER_SECRET,
    mpesaShortcode: process.env.MPESA_SHORTCODE,
    mpesaPasskey: process.env.MPESA_PASSKEY,
    mpesaCallbackUrl: process.env.MPESA_CALLBACK_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
    }
  },
  routeRules: {
  '/api/mpesa/**': { 
    cors: true,
    headers: { 'Access-Control-Allow-Origin': '*' }
  }
}
})