import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: '2023-10-16', // Using the latest stable version
  appInfo: {
    name: 'SourceVerify',
    version: '0.0.0',
    // Update this to your actual repository/website
    url: 'https://sourceverify.com'
  },
  typescript: true
})

//import Stripe from 'stripe'

////export const stripe = new Stripe(
////process.env.STRIPE_SECRET_KEY_LIVE ?? process.env.STRIPE_SECRET_KEY ?? '',
//export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
//  // https://github.com/stripe/stripe-node#configuration
//  // https://stripe.com/docs/api/versioning
//  // @ts-ignore
//  apiVersion: null,
//  // Register this as an official Stripe plugin.
//  // https://stripe.com/docs/building-plugins#setappinfo
//  appInfo: {
//    name: 'SourceVerify',
//    version: '0.0.0',
//    url: 'https://github.com/vercel/nextjs-subscription-payments'
//  }
//})
