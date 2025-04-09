import { redirect } from 'next/navigation'
import { getDefaultSignInView } from '@/app/utils/auth-helpers/settings'
import { cookies } from 'next/headers'

export default function SignIn() {
  const preferredSignInView =
    cookies().get('preferredSignInView')?.value || null
  const defaultView = getDefaultSignInView(preferredSignInView)

  return redirect(`/signin/${defaultView}`)
}

//'use client'

//import { useState } from 'react'
//import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

//export default function SignIn() {
//  const [email, setEmail] = useState('')
//  const [loading, setLoading] = useState(false)
//  const [message, setMessage] = useState<{
//    type?: 'success' | 'error'
//    text?: string
//  }>({})
//  const supabase = createClientComponentClient()

//  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
//    e.preventDefault()

//    try {
//      setLoading(true)
//      setMessage({})

//      const { error } = await supabase.auth.signInWithOtp({
//        email,
//        options: {
//          emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL
//            ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`
//            : 'https://stagingtowntwo.sourceverify.ai/dashboard'
//        }
//      })

//      if (error) {
//        throw error
//      }

//      setMessage({
//        type: 'success',
//        text: 'Check your email for the login link.'
//      })
//    } catch (error: any) {
//      setMessage({
//        type: 'error',
//        text:
//          error.error_description ||
//          error.message ||
//          'An error occurred during sign in.'
//      })
//    } finally {
//      setLoading(false)
//    }
//  }

//  return (
//    <div className="max-w-md mx-auto px-4 py-12">
//      <div className="bg-white shadow-md rounded-lg p-8">
//        <h1 className="text-2xl font-bold mb-6">Sign In</h1>

//        <form onSubmit={handleSignIn} className="space-y-6">
//          <div>
//            <label
//              htmlFor="email"
//              className="block text-sm font-medium text-gray-700 mb-1"
//            >
//              Email address
//            </label>
//            <input
//              id="email"
//              name="email"
//              type="email"
//              required
//              value={email}
//              onChange={(e) => setEmail(e.target.value)}
//              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
//              placeholder="you@example.com"
//            />
//          </div>

//          <button
//            type="submit"
//            disabled={loading}
//            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
//              loading ? 'opacity-50 cursor-not-allowed' : ''
//            }`}
//          >
//            {loading ? 'Sending Link...' : 'Send Magic Link'}
//          </button>
//        </form>

//        {message.text && (
//          <div
//            className={`mt-4 p-4 rounded-md ${
//              message.type === 'success'
//                ? 'bg-green-50 text-green-800'
//                : 'bg-red-50 text-red-800'
//            }`}
//          >
//            {message.text}
//          </div>
//        )}

//        <div className="mt-6 text-center">
//          <p className="text-sm text-gray-600">
//            Don't have an account?{' '}
//            <a
//              href="/pricing"
//              className="font-medium text-blue-600 hover:text-blue-500"
//            >
//              View our plans
//            </a>
//          </p>
//        </div>
//      </div>
//    </div>
//  )
//}
