export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const auth = Buffer.from(`${config.mpesaConsumerKey}:${config.mpesaConsumerSecret}`).toString('base64')

  const res = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${auth}` }
  })

  const data = await res.json()
  return { token: data.access_token }
})