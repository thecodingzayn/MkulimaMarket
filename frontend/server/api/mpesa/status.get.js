import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { checkoutRequestId } = getQuery(event)

  const supabase = createClient(
    process.env.SUPABASE_URL,
    config.supabaseServiceKey
  )

  // First check if already confirmed in Supabase
  const { data: boost } = await supabase
    .from('boosts')
    .select('*')
    .eq('checkout_request_id', checkoutRequestId)
    .single()

  if (boost?.status === 'confirmed') return { status: 'confirmed' }
  if (boost?.status === 'failed') return { status: 'failed' }

  // Still pending — query Daraja directly
  try {
    const auth = Buffer.from(`${config.mpesaConsumerKey}:${config.mpesaConsumerSecret}`).toString('base64')
    const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` }
    })
    const { access_token } = await tokenRes.json()

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const password = Buffer.from(`${config.mpesaShortcode}${config.mpesaPasskey}${timestamp}`).toString('base64')

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
    console.log('Daraja query result:', result)

    if (result.ResultCode === '0') {
      // Confirmed — update Supabase
      if (boost) {
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

    } else if (['1032', '1037', '2001'].includes(String(result.ResultCode))) {
      await supabase.from('boosts').update({ status: 'failed' })
        .eq('checkout_request_id', checkoutRequestId)
      return { status: 'failed' }

    } else {
      // Still pending or request not found yet
      return { status: 'pending' }
    }
  } catch (err) {
    console.error('Daraja query error:', err)
    // If Daraja unreachable, fall back to Supabase status
    return { status: boost?.status ?? 'pending' }
  }
})