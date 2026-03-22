import { Resend } from 'resend'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const resend = new Resend(config.resendApiKey)

  const { data, error } = await resend.emails.send({
    from: config.emailFrom,
    to: 'reginaldateya@gmail.com', // ← put your real email here
    subject: 'MkulimaMarket test email',
    html: '<h1>It works!</h1><p>Email notifications are working.</p>'
  })

  return { data, error }
})