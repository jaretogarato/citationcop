// pages/auth/signup.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

interface CheckoutSession {
  customer: string
  subscription: string
  metadata?: {
    plan?: string
  }
  customer_details?: {
    email?: string
  }
}

export default function Signup() {
  const router = useRouter()
  const { session_id } = router.query
  const [sessionData, setSessionData] = useState<CheckoutSession | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch session data when session_id is available
    if (session_id) {
      fetchCheckoutSession()
    }
  }, [session_id])

  async function fetchCheckoutSession() {
    try {
      const response = await fetch(
        '/api/stripe/checkout-session?session_id=' + session_id
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
      // Now TypeScript knows sessionData isn't null
      const {
        data: { user },
        error: signUpError
      } = await supabaseClient.auth.signUp({
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
        // Call a serverless function or RPC to link the user with subscription
        const { error: linkError } = await supabaseClient.functions.invoke(
          'link-subscription',
          {
            body: {
              user_id: user.id,
              stripe_customer_id: sessionData.customer,
              subscription_id: sessionData.subscription
            }
          }
        )

        if (linkError) throw linkError

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
