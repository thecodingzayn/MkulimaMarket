import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { checkoutRequestId } = getQuery(event)

  // Get access token
  const auth = Buffer.from(`${config.mpesaConsumerKey}:${config.mpesaConsumerSecret}`).toString('base64')
  const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${auth}` }
  })
  const { access_token } = await tokenRes.json()

  // Generate password
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
  const password = Buffer.from(`${config.mpesaShortcode}${config.mpesaPasskey}${timestamp}`).toString('base64')

  // Query STK push status from Daraja
  const queryRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: config.mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  })

  const result = await queryRes.json()

  const supabase = createClient(
    process.env.SUPABASE_URL,
    config.supabaseServiceKey
  )

  // ResultCode 0 = success, 1032 = cancelled, 1037 = timeout, 2001 = wrong PIN
  if (result.ResultCode === '0') {
    // Payment confirmed — activate boost
    const { data: boost } = await supabase
      .from('boosts')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single()

    if (boost && boost.status !== 'confirmed') {
      const startsAt = new Date()
      const endsAt = new Date()
      endsAt.setDate(endsAt.getDate() + boost.days)

      await supabase.from('boosts').update({
        status: 'confirmed',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      }).eq('checkout_request_id', checkoutRequestId)

      await supabase.from('products').update({
        is_boosted: true,
        boost_ends_at: endsAt.toISOString(),
      }).eq('id', boost.product_id)
    }

    return { status: 'confirmed' }

  } else if (result.ResultCode === '1032' || result.ResultCode === '1037' || result.ResultCode === '2001') {
    // Payment failed or cancelled
    await supabase.from('boosts').update({ status: 'failed' })
      .eq('checkout_request_id', checkoutRequestId)

    return { status: 'failed' }

  } else {
    // Still pending (ResultCode 1 = pending)
    return { status: 'pending' }
  }
})