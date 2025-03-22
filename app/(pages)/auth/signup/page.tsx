'use client'

// a distinction without a difference

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
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        // Pre-fill email from Stripe if available
        if (data.session.customer_details?.email) {
          setEmail(data.session.customer_details.email)
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

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!sessionData) {
      setError('No session data available')
      return
    }

    try {
      // Create user in Supabase Auth with metadata
      const {
        data: { user },
        error: signUpError
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            stripe_customer_id: sessionData.customer,
            subscription_id: sessionData.subscription,
            subscription_status: 'active',
            plan: sessionData.metadata?.plan || 'default'
          }
        }
      })

      if (signUpError) throw signUpError

      if (user) {
        // Create customer record linking Stripe customer with Supabase user
        const { error: customerError } = await supabase
          .from('customers')
          .insert({
            id: user.id, // Using the same ID for customer and user
            user_id: user.id,
            stripe_customer_id: sessionData.customer,
            subscription_status: 'active'
          })

        if (customerError) throw customerError

        // Insert subscription record
        if (sessionData.subscription) {
          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .insert({
              id: sessionData.subscription,
              user_id: user.id,
              status: 'active',
              price_id: sessionData.line_items?.data[0]?.price?.id,
              created: new Date().toISOString(),
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ).toISOString() // 30 days from now as a placeholder
            })

          if (subscriptionError) throw subscriptionError
        }

        // Redirect to dashboard after successful signup
        router.push('/dashboard')
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unknown error occurred')
      }
    }
  }

  if (loading) return <div>Verifying your purchase...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h1>Complete Your Account Setup</h1>
      <p>
        Thanks for your purchase! Create your account to access your
        subscription.
      </p>

      <form onSubmit={handleSignup}>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Create Account</button>
      </form>
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
