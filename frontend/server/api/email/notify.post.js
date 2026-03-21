import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const resend = new Resend(config.resendApiKey)
  const site = config.siteUrl || 'http://localhost:3000'

  const supabase = createClient(
    process.env.SUPABASE_URL,
    config.supabaseServiceKey
  )

  const body = await readBody(event)
  const { type, record, old_record } = body

  // Helper: get user email from auth.users via service role
  const getUserEmail = async (userId) => {
    const { data } = await supabase.auth.admin.getUserById(userId)
    return data?.user?.email ?? null
  }

  // Helper: get profile name
  const getProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single()
    return data
  }

  const send = async (to, subject, html) => {
    if (!to) return
    await resend.emails.send({
      from: config.emailFrom,
      to,
      subject,
      html
    })
  }

  // ─── LISTING APPROVED / REJECTED ──────────────────────────────────────────
  if (type === 'listing_status_changed') {
    const { id, title, status, rejection_reason, user_id } = record
    const email = await getUserEmail(user_id)
    const profile = await getProfile(user_id)
    const name = profile?.name ?? 'Farmer'

    if (status === 'active' && old_record?.status === 'reviewing') {
      await send(
        email,
        `✅ Your listing is live — ${title}`,
        listingApprovedTemplate({ name, title, listingUrl: `${site}/listings/${id}`, site })
      )
    }

    if (status === 'rejected' && old_record?.status !== 'rejected') {
      await send(
        email,
        `❌ Your listing was rejected — ${title}`,
        listingRejectedTemplate({ name, title, reason: rejection_reason, editUrl: `${site}/listings/edit/${id}`, site })
      )
    }

    return { ok: true }
  }

  // ─── NEW MESSAGE ──────────────────────────────────────────────────────────
  if (type === 'new_message') {
    const { conversation_id, sender_id, body: messageBody } = record

    // Get conversation to find recipient
    const { data: conv } = await supabase
      .from('conversations')
      .select('initiator_id, recipient_id, listing_id, products(title)')
      .eq('id', conversation_id)
      .single()

    if (!conv) return { ok: true }

    const recipientId = conv.initiator_id === sender_id
      ? conv.recipient_id
      : conv.initiator_id

    // Check if recipient has read any message in the last 10 minutes
    // (they're actively in the chat — don't email them)
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count: recentReads } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation_id)
      .eq('read', true)
      .neq('sender_id', recipientId)
      .gte('created_at', tenMinsAgo)

    if (recentReads > 0) return { ok: true } // They're active, skip email

    const email = await getUserEmail(recipientId)
    const senderProfile = await getProfile(sender_id)
    const recipientProfile = await getProfile(recipientId)

    await send(
      email,
      `💬 New message about "${conv.products?.title}"`,
      newMessageTemplate({
        name: recipientProfile?.name ?? 'Farmer',
        senderName: senderProfile?.name ?? 'Someone',
        listingTitle: conv.products?.title,
        messagePreview: messageBody?.slice(0, 100),
        conversationUrl: `${site}/messages?id=${conversation_id}`,
        site
      })
    )

    return { ok: true }
  }

  // ─── TRANSPORT APPLICATION SUBMITTED ─────────────────────────────────────
  if (type === 'transport_application_new') {
    const { request_id, user_id: applicantId, price_offer, message: appMessage } = record

    const { data: req } = await supabase
      .from('transport_requests')
      .select('user_id, pickup_location, destination, cargo_type')
      .eq('id', request_id)
      .single()

    if (!req) return { ok: true }

    const email = await getUserEmail(req.user_id)
    const ownerProfile = await getProfile(req.user_id)
    const applicantProfile = await getProfile(applicantId)

    await send(
      email,
      `🚛 New application for your transport request`,
      transportApplicationTemplate({
        name: ownerProfile?.name ?? 'Farmer',
        applicantName: applicantProfile?.name ?? 'Someone',
        route: `${req.pickup_location} → ${req.destination}`,
        cargo: req.cargo_type,
        priceOffer: price_offer,
        appMessage,
        requestUrl: `${site}/transport/${request_id}`,
        site
      })
    )

    return { ok: true }
  }

  // ─── TRANSPORT APPLICATION ACCEPTED / REJECTED ───────────────────────────
  if (type === 'transport_application_updated') {
    const { user_id: applicantId, status, request_id } = record
    if (!['accepted', 'rejected'].includes(status)) return { ok: true }

    const { data: req } = await supabase
      .from('transport_requests')
      .select('pickup_location, destination, cargo_type, contact_phone')
      .eq('id', request_id)
      .single()

    if (!req) return { ok: true }

    const email = await getUserEmail(applicantId)
    const profile = await getProfile(applicantId)

    await send(
      email,
      status === 'accepted'
        ? `✅ Your transport application was accepted!`
        : `❌ Your transport application was not accepted`,
      transportStatusTemplate({
        name: profile?.name ?? 'Farmer',
        status,
        route: `${req.pickup_location} → ${req.destination}`,
        cargo: req.cargo_type,
        contactPhone: status === 'accepted' ? req.contact_phone : null,
        requestUrl: `${site}/transport/${request_id}`,
        site
      })
    )

    return { ok: true }
  }

  // ─── LISTING EXPIRING SOON (called by pg_cron) ────────────────────────────
  if (type === 'expiry_reminder') {
    const { data: expiring } = await supabase
      .from('products')
      .select('id, title, user_id, expires_at')
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .lte('expires_at', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())

    for (const listing of expiring ?? []) {
      const email = await getUserEmail(listing.user_id)
      const profile = await getProfile(listing.user_id)
      const daysLeft = Math.ceil(
        (new Date(listing.expires_at) - new Date()) / (1000 * 60 * 60 * 24)
      )

      await send(
        email,
        `⏳ Your listing expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — ${listing.title}`,
        expiryReminderTemplate({
          name: profile?.name ?? 'Farmer',
          title: listing.title,
          daysLeft,
          editUrl: `${site}/listings/edit/${listing.id}`,
          site
        })
      )
    }

    return { ok: true }
  }

  // ─── INACTIVE USER REMINDER (called by pg_cron) ───────────────────────────
  if (type === 'inactive_reminder') {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Get users with active listings who haven't logged in for 7 days
    const { data: inactiveUsers } = await supabase
      .from('profiles')
      .select('id, name')
      .lt('updated_at', oneWeekAgo)

    for (const profile of inactiveUsers ?? []) {
      // Check they have at least one active listing
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('status', 'active')

      if (!count) continue

      // Check for unread messages
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`initiator_id.eq.${profile.id},recipient_id.eq.${profile.id}`)

      let unreadCount = 0
      if (convs?.length) {
        const { count: unread } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', convs.map(c => c.id))
          .neq('sender_id', profile.id)
          .eq('read', false)
        unreadCount = unread ?? 0
      }

      const email = await getUserEmail(profile.id)

      await send(
        email,
        `👋 You have ${unreadCount > 0 ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'} on` : 'active listings on'} MkulimaMarket`,
        inactiveReminderTemplate({
          name: profile.name ?? 'Farmer',
          activeListings: count,
          unreadMessages: unreadCount,
          dashboardUrl: `${site}/dashboard`,
          messagesUrl: `${site}/messages`,
          site
        })
      )
    }

    return { ok: true }
  }

  return { ok: true }
})

// ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f3f4f6;
  margin: 0;
  padding: 0;
`

const wrapper = (content) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="${baseStyle}">
  <div style="max-width: 560px; margin: 32px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: #16a34a; padding: 24px 32px;">
      <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">🌾 MkulimaMarket</h1>
    </div>
    <!-- Body -->
    <div style="padding: 32px;">
      ${content}
    </div>
    <!-- Footer -->
    <div style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        MkulimaMarket · Connecting Kenyan farmers to buyers<br/>
        <a href="${'${site}'}" style="color: #16a34a;">Visit MkulimaMarket</a>
      </p>
    </div>
  </div>
</body>
</html>
`

const btn = (url, text, color = '#16a34a') =>
  `<a href="${url}" style="display:inline-block; background:${color}; color:white; padding:12px 24px; border-radius:10px; font-weight:600; text-decoration:none; font-size:14px; margin-top:16px;">${text}</a>`

const listingApprovedTemplate = ({ name, title, listingUrl, site }) => wrapper(`
  <h2 style="color:#111827; margin:0 0 8px;">Your listing is live! ✅</h2>
  <p style="color:#6b7280; margin:0 0 20px;">Hi ${name},</p>
  <p style="color:#374151;">Great news! Your listing <strong>"${title}"</strong> has been approved and is now visible to buyers across Kenya.</p>
  <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:16px; margin:20px 0;">
    <p style="margin:0; color:#15803d; font-weight:600;">📦 ${title}</p>
    <p style="margin:4px 0 0; color:#16a34a; font-size:13px;">Status: Active ✅</p>
  </div>
  <p style="color:#374151;">Share your listing with friends and local markets to get more buyers!</p>
  ${btn(listingUrl, 'View Your Listing')}
`)

const listingRejectedTemplate = ({ name, title, reason, editUrl, site }) => wrapper(`
  <h2 style="color:#111827; margin:0 0 8px;">Listing needs attention ❌</h2>
  <p style="color:#6b7280; margin:0 0 20px;">Hi ${name},</p>
  <p style="color:#374151;">Unfortunately your listing <strong>"${title}"</strong> was not approved.</p>
  <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:16px; margin:20px 0;">
    <p style="margin:0; color:#dc2626; font-weight:600;">Reason:</p>
    <p style="margin:6px 0 0; color:#b91c1c;">${reason || 'Did not meet our listing guidelines.'}</p>
  </div>
  <p style="color:#374151;">You can edit your listing and resubmit for review. Common fixes include adding a clear photo, accurate price, and complete description.</p>
  ${btn(editUrl, 'Edit & Resubmit', '#dc2626')}
`)

const newMessageTemplate = ({ name, senderName, listingTitle, messagePreview, conversationUrl, site }) => wrapper(`
  <h2 style="color:#111827; margin:0 0 8px;">New message from ${senderName} 💬</h2>
  <p style="color:#6b7280; margin:0 0 20px;">Hi ${name},</p>
  <p style="color:#374151;"><strong>${senderName}</strong> sent you a message about your listing <strong>"${listingTitle}"</strong>.</p>
  <div style="background:#f0fdf4; border-left:4px solid #16a34a; border-radius:0 10px 10px 0; padding:16px; margin:20px 0;">
    <p style="margin:0; color:#374151; font-style:italic;">"${messagePreview}${messagePreview?.length >= 100 ? '...' : ''}"</p>
  </div>
  <p style="color:#374151;">Reply quickly to increase your chances of making a sale!</p>
  ${btn(conversationUrl, 'Reply Now')}
`)

const transportApplicationTemplate = ({ name, applicantName, route, cargo, priceOffer, appMessage, requestUrl, site }) => wrapper(`
  <h2 style="color:#111827; margin:0 0 8px;">New transport application 🚛</h2>
  <p style="color:#6b7280; margin:0 0 20px;">Hi ${name},</p>
  <p style="color:#374151;"><strong>${applicantName}</strong> has applied for your transport request.</p>
  <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:16px; margin:20px 0;">
    <p style="margin:0 0 6px; color:#374151;"><strong>Route:</strong> ${route}</p>
    <p style="margin:0 0 6px; color:#374151;"><strong>Cargo:</strong> ${cargo}</p>
    ${priceOffer ? `<p style="margin:0 0 6px; color:#374151;"><strong>Price offer:</strong> KSh ${Number(priceOffer).toLocaleString('en-KE')}</p>` : ''}
    ${appMessage ? `<p style="margin:6px 0 0; color:#6b7280; font-style:italic;">"${appMessage}"</p>` : ''}
  </div>
  <p style="color:#374151;">Review the application and accept or reject on MkulimaMarket.</p>
  ${btn(requestUrl, 'View Application')}
`)

const transportStatusTemplate = ({ name, status, route, cargo, contactPhone, requestUrl, site }) => wrapper(`
  <h2 style="color:#111827; margin:0 0 8px;">
    ${status === 'accepted' ? 'Application accepted! 🎉' : 'Application update'}
  </h2>
  <p style="color:#6b7280; margin:0 0 20px;">Hi ${name},</p>
  ${status === 'accepted' ? `
    <p style="color:#374151;">Great news! Your transport application has been <strong>accepted</strong>.</p>
    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:16px; margin:20px 0;">
      <p style="margin:0 0 6px; color:#374151;"><strong>Route:</strong> ${route}</p>
      <p style="margin:0 0 6px; color:#374151;"><strong>Cargo:</strong> ${cargo}</p>
      ${contactPhone ? `<p style="margin:0; color:#374151;"><strong>Contact:</strong> <a href="tel:${contactPhone}" style="color:#16a34a;">${contactPhone}</a></p>` : ''}
    </div>
    <p style="color:#374151;">Contact the requester to confirm the details and arrange pickup.</p>
  ` : `
    <p style="color:#374151;">Unfortunately your application for the transport request <strong>${route}</strong> was not accepted this time.</p>
    <p style="color:#374151;">Keep an eye out for other transport requests on MkulimaMarket.</p>
  `}
  ${btn(requestUrl, 'View Request', status === 'accepted' ? '#16a34a' : '#6b7280')}
`)

const expiryReminderTemplate = ({ name, title, daysLeft, editUrl, site }) => wrapper(`
  <h2 style="color:#111827; margin:0 0 8px;">Your listing expires soon ⏳</h2>
  <p style="color:#6b7280; margin:0 0 20px;">Hi ${name},</p>
  <p style="color:#374151;">Your listing <strong>"${title}"</strong> will expire in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.</p>
  <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:16px; margin:20px 0;">
    <p style="margin:0; color:#92400e;">⚠️ Once expired, your listing will no longer be visible to buyers.</p>
  </div>
  <p style="color:#374151;">Extend your listing duration to keep it active and reach more buyers.</p>
  ${btn(editUrl, 'Extend Listing', '#f59e0b')}
`)

const inactiveReminderTemplate = ({ name, activeListings, unreadMessages, dashboardUrl, messagesUrl, site }) => wrapper(`
  <h2 style="color:#111827; margin:0 0 8px;">You've been missed! 👋</h2>
  <p style="color:#6b7280; margin:0 0 20px;">Hi ${name},</p>
  <p style="color:#374151;">It's been a week since your last visit to MkulimaMarket. Here's what's happening with your account:</p>
  <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:16px; margin:20px 0;">
    <p style="margin:0 0 8px; color:#374151;">📦 <strong>${activeListings}</strong> active listing${activeListings === 1 ? '' : 's'}</p>
    ${unreadMessages > 0
      ? `<p style="margin:0; color:#dc2626;">💬 <strong>${unreadMessages}</strong> unread message${unreadMessages === 1 ? '' : 's'} waiting for you</p>`
      : `<p style="margin:0; color:#6b7280;">💬 No unread messages</p>`
    }
  </div>
  ${unreadMessages > 0
    ? `<p style="color:#374151;">You have buyers waiting for your reply — don't miss a sale!</p>${btn(messagesUrl, 'Read Messages')}`
    : `<p style="color:#374151;">Check your dashboard to see how your listings are performing.</p>${btn(dashboardUrl, 'View Dashboard')}`
  }
`)