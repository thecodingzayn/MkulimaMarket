import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  const { phone, amount, days, productId, userId } = body

  // Get access token
  const auth = Buffer.from(`${config.mpesaConsumerKey}:${config.mpesaConsumerSecret}`).toString('base64')
  const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${auth}` }
  })
  const { access_token } = await tokenRes.json()

  // Generate password
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
  const password = Buffer.from(`${config.mpesaShortcode}${config.mpesaPasskey}${timestamp}`).toString('base64')

  // Format phone: 0712345678 → 254712345678
  const formattedPhone = phone.startsWith('0')
    ? `254${phone.slice(1)}`
    : phone.startsWith('+')
      ? phone.slice(1)
      : phone

  // Initiate STK push
  const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: config.mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: config.mpesaShortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: config.mpesaCallbackUrl,
      AccountReference: `Boost-${productId}`,
      TransactionDesc: `Boost listing for ${days} days`,
    }),
  })

  const stkData = await stkRes.json()

  if (stkData.ResponseCode !== '0') {
    throw createError({ statusCode: 400, message: stkData.errorMessage ?? 'STK push failed' })
  }

  // Save pending boost to Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    config.supabaseServiceKey
  )

  const { data: boost, error } = await supabase.from('boosts').insert({
    product_id: productId,
    user_id: userId,
    phone: formattedPhone,
    amount,
    days,
    status: 'pending',
    checkout_request_id: stkData.CheckoutRequestID,
    merchant_request_id: stkData.MerchantRequestID,
  }).select().single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return {
    success: true,
    checkoutRequestId: stkData.CheckoutRequestID,
    boostId: boost.id,
  }
})