'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { ReadonlyURLSearchParams } from 'next/navigation'

interface CheckoutSession {
  customer: string
  subscription: string
  line_items?: {
    data: Array<{
      price?: {
        id: string
      }
    }>
  }
  metadata?: {
    plan?: string
  }
  customer_details?: {
    email?: string
  }
}

// Component that uses searchParams with proper typing
function SignupContent({
  searchParams
}: {
  searchParams: ReadonlyURLSearchParams
}) {
  const router = useRouter()
  const session_id = searchParams.get('session_id')

  const [sessionData, setSessionData] = useState<CheckoutSession | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accountCreated, setAccountCreated] = useState(false)

  const supabase = createClientComponentClient()

  useEffect(() => {
    // Fetch session data when session_id is available
    if (session_id) {
      fetchCheckoutSession()
    } else {
      setLoading(false)
    }
  }, [session_id])

  async function fetchCheckoutSession() {
    try {
      const response = await fetch(
        `/api/stripe/checkout-session?session_id=${session_id}`
      )
      const data = await response.json()

      if (data.session) {
        setSessionData(data.session)

        // Auto-create account if we have customer email
        if (data.session.customer_details?.email) {
          const email = data.session.customer_details.email
          setEmail(email)
          await createAccountWithMagicLink(email, data.session)
        } else {
          setError('No email found in checkout session')
        }
      } else {
        setError('Invalid checkout session')
      }
    } catch (err) {
      setError('Failed to verify checkout')
    } finally {
      setLoading(false)
    }
  }

  async function createAccountWithMagicLink(
    email: string,
    sessionData: CheckoutSession
  ) {
    try {
      // Generate a random password since Supabase requires one
      const randomPassword =
        Math.random().toString(36).slice(-10) +
        Math.random().toString(36).toUpperCase().slice(-2) +
        Math.random().toString(36).slice(-2) +
        '!'

      // Create user with a password (required by Supabase)
      const { data, error } = await supabase.auth.signUp({
        email,
        password: randomPassword, // Random secure password that won't be used
        options: {
          data: {
            stripe_customer_id: sessionData.customer,
            subscription_id: sessionData.subscription,
            subscription_status: 'active',
            plan: sessionData.metadata?.plan || 'default'
          }
        }
      })

      if (error) {
        // If error is "User already registered", that's fine - proceed with magic link
        if (!error.message.includes('already registered')) {
          throw error
        }
      }

      // Create customer record if we have a user
      if (data?.user) {
        try {
          const { error: customerError } = await supabase
            .from('customers')
            .insert({
              id: data.user.id,
              user_id: data.user.id,
              stripe_customer_id: sessionData.customer,
              subscription_status: 'active'
            })

          // If we get a duplicate key error, that's fine
          if (
            customerError &&
            !customerError.message.includes('duplicate key')
          ) {
            throw customerError
          }

          // Insert subscription record
          if (sessionData.subscription) {
            const { error: subscriptionError } = await supabase
              .from('subscriptions')
              .insert({
                id: sessionData.subscription,
                user_id: data.user.id,
                status: 'active',
                price_id: sessionData.line_items?.data[0]?.price?.id,
                created: new Date().toISOString(),
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000
                ).toISOString()
              })

            // Again, if we get a duplicate key error, that's fine
            if (
              subscriptionError &&
              !subscriptionError.message.includes('duplicate key')
            ) {
              throw subscriptionError
            }
          }
        } catch (err) {
          console.error('Error creating records:', err)
          // Continue anyway to send magic link
        }
      }

      // Send magic link (whether new user or existing)
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      })

      if (otpError) throw otpError

      setAccountCreated(true)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unknown error occurred')
      }
    }
  }

  //async function createAccountWithMagicLink(
  //  email: string,
  //  sessionData: CheckoutSession
  //) {
  //  try {
  //    // First, check if user already exists
  //    const { data: existingUser } =
  //      await supabase.auth.admin.getUserByEmail(email)

  //    if (!existingUser) {
  //      // Generate a random password since Supabase requires one
  //      const randomPassword =
  //        Math.random().toString(36).slice(-10) +
  //        Math.random().toString(36).toUpperCase().slice(-2) +
  //        Math.random().toString(36).slice(-2) +
  //        '!'

  //      // Create user with a password (required by Supabase)
  //      const { data, error } = await supabase.auth.signUp({
  //        email,
  //        password: randomPassword, // Random secure password that won't be used
  //        options: {
  //          data: {
  //            stripe_customer_id: sessionData.customer,
  //            subscription_id: sessionData.subscription,
  //            subscription_status: 'active',
  //            plan: sessionData.metadata?.plan || 'default'
  //          }
  //        }
  //      })

  //      if (error) throw error

  //      // Create customer record
  //      if (data.user) {
  //        const { error: customerError } = await supabase
  //          .from('customers')
  //          .insert({
  //            id: data.user.id,
  //            user_id: data.user.id,
  //            stripe_customer_id: sessionData.customer,
  //            subscription_status: 'active'
  //          })

  //        if (customerError) throw customerError

  //        // Insert subscription record
  //        if (sessionData.subscription) {
  //          const { error: subscriptionError } = await supabase
  //            .from('subscriptions')
  //            .insert({
  //              id: sessionData.subscription,
  //              user_id: data.user.id,
  //              status: 'active',
  //              price_id: sessionData.line_items?.data[0]?.price?.id,
  //              created: new Date().toISOString(),
  //              current_period_start: new Date().toISOString(),
  //              current_period_end: new Date(
  //                Date.now() + 30 * 24 * 60 * 60 * 1000
  //              ).toISOString()
  //            })

  //          if (subscriptionError) throw subscriptionError
  //        }
  //      }
  //    }

  //    // Send magic link (whether new user or existing)
  //    const { error: otpError } = await supabase.auth.signInWithOtp({
  //      email,
  //      options: {
  //        emailRedirectTo: `${window.location.origin}/dashboard`
  //      }
  //    })

  //    if (otpError) throw otpError

  //    setAccountCreated(true)
  //  } catch (err) {
  //    if (err instanceof Error) {
  //      setError(err.message)
  //    } else {
  //      setError('An unknown error occurred')
  //    }
  //  }
  //}

  if (loading) return <div>Verifying your purchase...</div>
  if (error) return <div>Error: {error}</div>

  if (accountCreated) {
    return (
      <div>
        <h1>Account Created Successfully!</h1>
        <p>We've sent a login link to your email at {email}.</p>
        <p>
          Please check your inbox and click the link to access your dashboard.
        </p>
        <p>If you don't see the email, please check your spam folder.</p>
      </div>
    )
  }

  // Fallback UI in case auto-creation fails
  return (
    <div>
      <h1>Complete Your Account Setup</h1>
      <p>
        We tried to automatically set up your account, but there was an issue.
        Please try again using the button below.
      </p>
      <button
        onClick={() => createAccountWithMagicLink(email, sessionData!)}
        disabled={!sessionData || !email}
      >
        Create Account & Send Login Link
      </button>
    </div>
  )
}

// Client component that accesses searchParams
function SignupWithSearchParams() {
  const searchParams = useSearchParams()
  return <SignupContent searchParams={searchParams} />
}

// Main component with Suspense boundary
export default function Signup() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupWithSearchParams />
    </Suspense>
  )
}

//<div>
//      <h1>Complete Your Account Setup</h1>
//      <p>
//        Thanks for your purchase! Create your account to access your
//        subscription.
//      </p>

//      <form onSubmit={handleSignup}>
//        <div>
//          <label>Email</label>
//          <input
//            type="email"
//            value={email}
//            onChange={(e) => setEmail(e.target.value)}
//            required
//          />
//        </div>
//        <div>
//          <label>Password</label>
//          <input
//            type="password"
//            value={password}
//            onChange={(e) => setPassword(e.target.value)}
//            required
//          />
//        </div>
//        <button type="submit">Create Account</button>
//      </form>
//    </div>
