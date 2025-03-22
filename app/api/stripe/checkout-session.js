import Stripe from 'stripe'

export default async function handler(req, res) {
  const { session_id } = req.query

  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id parameter' })
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET, {
      apiVersion: '2023-10-16'
    })

    // Retrieve the checkout session with expanded objects
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['customer', 'subscription']
    })

    return res.status(200).json({ session })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
