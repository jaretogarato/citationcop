import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

interface EmailVerificationStepProps {
  onContinue: (email: string) => void
  planId: string
}

export default function EmailVerificationStep({
  onContinue,
  planId
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

      // Check if user exists using a server API endpoint instead of direct Supabase admin access
      // This is more secure and avoids client-side permission issues
      const response = await fetch('/api/check-user-exists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      if (!response.ok) {
        throw new Error('Failed to check user existence')
      }

      const { exists } = await response.json()

      if (exists) {
        // User exists, redirect to sign in page with return URL
        const returnUrl = `/checkout?plan=${planId}&email=${encodeURIComponent(email)}`
        router.push(`/signin?return_to=${encodeURIComponent(returnUrl)}`)
      } else {
        // No existing user, proceed to checkout
        onContinue(email)
      }
    } catch (err) {
      console.error('Error checking user:', err)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Before we continue</h2>
      <p className="mb-4">
        Please enter your email address to continue with your subscription.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            placeholder="you@example.com"
            required
          />
        </div>

        {error && (
          <div className="mb-4 p-2 text-sm text-red-600 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Continue to checkout'}
        </button>
      </form>
    </div>
  )
}
