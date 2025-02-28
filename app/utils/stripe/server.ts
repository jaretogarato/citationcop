'use server'

import Stripe from 'stripe'
import { stripe } from '@/app/utils/stripe/config'
import { createClient } from '@/app/utils/supabase/server'
import { createOrRetrieveCustomer } from '@/app/utils/supabase/admin'
import {
  getURL,
  getErrorRedirect,
  calculateTrialEndUnixTimestamp
} from '@/app/utils/helpers'
import { Tables } from '@/types_db'

type Price = Tables<'prices'>

type CheckoutResponse = {
  errorRedirect?: string
  sessionId?: string
}

export async function checkoutWithStripe(
  price: Price,
  redirectPath: string = '/account'
): Promise<CheckoutResponse> {
  try {
    // Get the user from Supabase auth
    const supabase = createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    // Base params shared between both payment modes
    let params: Stripe.Checkout.SessionCreateParams = {
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      line_items: [
        {
          price: price.id,
          quantity: 1
        }
      ],
      cancel_url: getURL(),
      metadata: {
        price_id: price.id
      }
    }

    // Handle user-specific settings
    if (user) {
      try {
        const customer = await createOrRetrieveCustomer({
          uuid: user.id,
          email: user.email || ''
        })
        params.customer = customer
        params.customer_update = {
          address: 'auto'
        }
        params.success_url = getURL(redirectPath) // Use normal redirect for logged-in users
      } catch (err) {
        console.error(err)
        throw new Error('Unable to access customer record.')
      }
    } else {
      // For users not logged in, use a different success URL
      params.success_url = `${getURL()}/auth/signup?session_id={CHECKOUT_SESSION_ID}`
    }

    // Apply mode-specific settings
    if (price.type === 'recurring') {
      params = {
        ...params,
        mode: 'subscription',
        subscription_data: {
          trial_end: calculateTrialEndUnixTimestamp(price.trial_period_days)
        }
      }

      // For subscription mode without a logged-in user:
      // We can't use customer_creation here, but we need a way to handle customer
      if (!user) {
        // Option 1: Let Stripe collect the email
        params.customer_email = undefined
      }
    } else if (price.type === 'one_time') {
      params = {
        ...params,
        mode: 'payment'
      }

      // Only add customer_creation for payment mode without a logged-in user
      if (!user) {
        params.customer_creation = 'always'
        params.customer_email = undefined // Let Stripe collect it
      }
    }

    // Create a checkout session in Stripe
    let session
    try {
      session = await stripe.checkout.sessions.create(params)
    } catch (err) {
      console.error(err)
      throw new Error('Unable to create checkout session.')
    }

    if (session) {
      return { sessionId: session.id }
    } else {
      throw new Error('Unable to create checkout session.')
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        errorRedirect: getErrorRedirect(
          redirectPath,
          error.message,
          'Please try again later or contact a system administrator.'
        )
      }
    } else {
      return {
        errorRedirect: getErrorRedirect(
          redirectPath,
          'An unknown error occurred.',
          'Please try again later or contact a system administrator.'
        )
      }
    }
  }
}

export async function createStripePortal(currentPath: string) {
  try {
    const supabase = createClient()
    const {
      error,
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      if (error) {
        console.error(error)
      }
      throw new Error('Could not get user session.')
    }

    let customer
    try {
      customer = await createOrRetrieveCustomer({
        uuid: user.id || '',
        email: user.email || ''
      })
    } catch (err) {
      console.error(err)
      throw new Error('Unable to access customer record.')
    }

    if (!customer) {
      throw new Error('Could not get customer.')
    }

    try {
      const { url } = await stripe.billingPortal.sessions.create({
        customer,
        return_url: getURL('/account')
      })
      if (!url) {
        throw new Error('Could not create billing portal')
      }
      return url
    } catch (err) {
      console.error(err)
      throw new Error('Could not create billing portal')
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error)
      return getErrorRedirect(
        currentPath,
        error.message,
        'Please try again later or contact a system administrator.'
      )
    } else {
      return getErrorRedirect(
        currentPath,
        'An unknown error occurred.',
        'Please try again later or contact a system administrator.'
      )
    }
  }
}
