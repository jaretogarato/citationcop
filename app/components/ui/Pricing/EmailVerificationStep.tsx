'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

interface EmailVerificationStepProps {
  onBack: () => void
  onContinue: (email: string) => void
  selectedPrice: any
  billingInterval: string
}

export default function EmailVerificationStep({
  onBack,
  onContinue,
  selectedPrice,
  billingInterval
}: EmailVerificationStepProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClientComponentClient()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // First, check if the email is valid
      if (!email || !email.includes('@')) {
        setError('Please enter a valid email address')
        setLoading(false)
        return
      }

      // Check if user exists by trying to sign in with OTP
      // but set shouldCreateUser to false
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          // Don't actually send an email, we're just checking
          captchaToken: 'check_only'
        }
      })

      // If there's no error or the error isn't about a missing user,
      // then the user exists
      const userExists =
        !signInError ||
        (signInError.message &&
          !signInError.message.toLowerCase().includes('user not found') &&
          !signInError.message.toLowerCase().includes('user does not exist'))

      if (userExists) {
        // User exists, store the price info and redirect to sign in
        if (typeof window !== 'undefined') {
          localStorage.setItem('selectedPriceId', selectedPrice.id)
          localStorage.setItem('selectedInterval', billingInterval)
        }

        // Redirect to sign in page
        router.push(
          `/signin/email_signin?subscription_started=true&email=${encodeURIComponent(email)}`
        )
      } else {
        // No existing user, proceed to checkout
        onContinue(email)
      }
    } catch (err: any) {
      console.error('Error checking user:', err)
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-zinc-900 rounded-lg shadow-md border border-zinc-800">
      <h2 className="text-2xl font-bold mb-6 text-white">Confirm your email</h2>
      <p className="mb-4 text-zinc-300">
        Please enter your email address to continue with your subscription.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-300 mb-1"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 text-white"
            placeholder="you@example.com"
            required
          />
        </div>

        {error && (
          <div className="mb-4 p-2 text-sm text-red-400 bg-red-900 bg-opacity-30 rounded-md">
            {error}
          </div>
        )}

        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-2 px-4 border border-zinc-700 rounded-md shadow-sm text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  )
}

//import { useState } from 'react'
//import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
//import { useRouter } from 'next/navigation'

//interface EmailVerificationStepProps {
//  onContinue: (email: string) => void
//  planId: string
//}

//export default function EmailVerificationStep({
//  onContinue,
//  planId
//}: EmailVerificationStepProps) {
//  const [email, setEmail] = useState('')
//  const [loading, setLoading] = useState(false)
//  const [error, setError] = useState<string | null>(null)
//  const supabase = createClientComponentClient()
//  const router = useRouter()

//  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//    e.preventDefault()
//    setLoading(true)
//    setError(null)

//    try {
//      // First, check if the email is valid
//      if (!email || !email.includes('@')) {
//        setError('Please enter a valid email address')
//        setLoading(false)
//        return
//      }

//      // Check if user exists using a server API endpoint instead of direct Supabase admin access
//      // This is more secure and avoids client-side permission issues
//      const response = await fetch('/api/check-user-exists', {
//        method: 'POST',
//        headers: {
//          'Content-Type': 'application/json'
//        },
//        body: JSON.stringify({ email })
//      })

//      if (!response.ok) {
//        throw new Error('Failed to check user existence')
//      }

//      const { exists } = await response.json()

//      if (exists) {
//        // User exists, redirect to sign in page with return URL
//        const returnUrl = `/checkout?plan=${planId}&email=${encodeURIComponent(email)}`
//        router.push(`/signin?return_to=${encodeURIComponent(returnUrl)}`)
//      } else {
//        // No existing user, proceed to checkout
//        onContinue(email)
//      }
//    } catch (err) {
//      console.error('Error checking user:', err)
//      setError('An error occurred. Please try again.')
//    } finally {
//      setLoading(false)
//    }
//  }

//  return (
//    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
//      <h2 className="text-2xl font-bold mb-6">Before we continue</h2>
//      <p className="mb-4">
//        Please enter your email address to continue with your subscription.
//      </p>

//      <form onSubmit={handleSubmit}>
//        <div className="mb-4">
//          <label
//            htmlFor="email"
//            className="block text-sm font-medium text-gray-700 mb-1"
//          >
//            Email address
//          </label>
//          <input
//            id="email"
//            type="email"
//            value={email}
//            onChange={(e) => setEmail(e.target.value)}
//            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
//            placeholder="you@example.com"
//            required
//          />
//        </div>

//        {error && (
//          <div className="mb-4 p-2 text-sm text-red-600 bg-red-50 rounded-md">
//            {error}
//          </div>
//        )}

//        <button
//          type="submit"
//          disabled={loading}
//          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
//        >
//          {loading ? 'Checking...' : 'Continue to checkout'}
//        </button>
//      </form>
//    </div>
//  )
//}
