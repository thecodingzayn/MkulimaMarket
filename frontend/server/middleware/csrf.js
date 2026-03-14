export default defineEventHandler((event) => {
  if (event.path?.startsWith('/api/mpesa/')) {
    event.context.skipCsrf = true
  }
})