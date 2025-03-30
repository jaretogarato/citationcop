'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Button from '@/app/components/ui/Button'

interface EmailSignInProps {
  allowPassword?: boolean
  redirectMethod?: 'client' | 'server'
  disableButton?: boolean
  email?: string
  subscriptionContext?: {
    subscriptionStarted: boolean
    email: string
    returnTo: string
  }
}

export default function EmailSignIn({
  allowPassword,
  redirectMethod = 'client',
  disableButton,
  email: initialEmail = '',
  subscriptionContext
}: EmailSignInProps) {
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    type?: 'success' | 'error'
    text?: string
  }>({})
  const supabase = createClientComponentClient()
  const router = redirectMethod === 'client' ? useRouter() : null

  // Pre-fill email if provided
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail)
    }
  }, [initialEmail])

  // Modify your handleSignIn function in EmailSignIn.tsx

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    try {
      setLoading(true)
      setMessage({})

      // Always redirect to dashboard regardless of subscription context
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`
        : 'https://yourdomain.com/dashboard'

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl
        }
      })

      if (error) throw error

      setMessage({
        type: 'success',
        text: 'Check your email for the login link we just sent you.'
      })
    } catch (error: any) {
      setMessage({
        type: 'error',
        text:
          error.error_description ||
          error.message ||
          'An error occurred during sign in.'
      })
    } finally {
      setLoading(false)
    }
  }

  //const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
  //  e.preventDefault()

  //  try {
  //    setLoading(true)
  //    setMessage({})

  //    // Determine redirect URL based on subscription context
  //    let redirectUrl

  //    if (
  //      subscriptionContext?.subscriptionStarted &&
  //      subscriptionContext.returnTo
  //    ) {
  //      redirectUrl = subscriptionContext.returnTo
  //    } else if (subscriptionContext?.subscriptionStarted) {
  //      redirectUrl = `/checkout?subscription_started=true&email=${encodeURIComponent(email)}`
  //    } else {
  //      redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
  //        ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`
  //        : 'https://yourdomain.com/dashboard'
  //    }

  //    const { error } = await supabase.auth.signInWithOtp({
  //      email,
  //      options: {
  //        emailRedirectTo: redirectUrl
  //      }
  //    })

  //    if (error) throw error

  //    setMessage({
  //      type: 'success',
  //      text: 'Check your email for the login link we just sent you.'
  //    })
  //  } catch (error: any) {
  //    setMessage({
  //      type: 'error',
  //      text:
  //        error.error_description ||
  //        error.message ||
  //        'An error occurred during sign in.'
  //    })
  //  } finally {
  //    setLoading(false)
  //  }
  //}

  return (
    <div>
      <form onSubmit={handleSignIn} className="flex flex-col gap-4">
        <div className="mb-3">
          <label
            htmlFor="email"
            className="block text-gray-700 text-sm font-medium dark:text-gray-300 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            className="appearance-none border border-gray-300 rounded-md shadow-sm w-full py-2 px-3 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primaryColor focus:border-transparent dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {message.text && (
          <div
            className={`rounded-md p-3 text-sm ${
              message.type === 'error'
                ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800'
                : 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-3">
          <Button
            variant="slim"
            type="submit"
            loading={loading}
            disabled={loading || disableButton}
            className="w-full"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </Button>
        </div>

        {allowPassword && (
          <div className="text-center mt-3">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Prefer passwords?{' '}
            </span>
            <a
              href="/signin/password_signin"
              className="text-sm text-primaryColor hover:underline hover:text-primaryColorDarker"
            >
              Sign in with password
            </a>
          </div>
        )}
      </form>
    </div>
  )
}
//'use client'

//import { useState } from 'react'
//import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
//import Link from 'next/link'
//import Image from 'next/image'

//export default function EmailSignIn() {
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
//            : 'https://stagingtowntwo.sourceverify.ai/dashboard',
//          shouldCreateUser: false
//        }
//      })

//      if (error) {
//        throw error
//      }

//      setMessage({
//        type: 'success',
//        text: 'Check your email for the login link we just sent you.'
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
//    <div className="w-full max-w-md mx-auto">
//      {/*<div className="text-center mb-8">
//        <Image
//          src="/source-verify-logo-d.png"
//          alt="SourceVerify Logo"
//          width={80}
//          height={80}
//          className="mx-auto"
//        />
//      </div>*/}

//      <div className="bg-white rounded-lg shadow-lg p-8">
//        <h1 className="text-2xl font-bold text-center mb-6">
//          Sign in with Magic Link
//        </h1>

//        {message.text ? (
//          <div
//            className={`mb-6 p-4 rounded-md ${
//              message.type === 'success'
//                ? 'bg-green-50 text-green-700 border border-green-200'
//                : 'bg-red-50 text-red-700 border border-red-200'
//            }`}
//          >
//            <p>{message.text}</p>
//            {message.type === 'success' && (
//              <p className="mt-2 text-sm">
//                The link will expire in 24 hours. If you don't see the email,
//                please check your spam folder.
//              </p>
//            )}
//          </div>
//        ) : (
//          <p className="text-gray-600 mb-6 text-center">
//            Enter your email and we'll send you a magic link to sign in
//            instantly.
//          </p>
//        )}

//        <form onSubmit={handleSignIn} className="space-y-4">
//          <div>
//            <label
//              htmlFor="email"
//              className="block text-sm font-medium text-gray-700 mb-1"
//            >
//              Email
//            </label>
//            <input
//              id="email"
//              name="email"
//              type="email"
//              required
//              value={email}
//              onChange={(e) => setEmail(e.target.value)}
//              className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
//              placeholder="you@example.com"
//              disabled={loading || message.type === 'success'}
//            />
//          </div>

//          <button
//            type="submit"
//            disabled={loading || message.type === 'success'}
//            className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors
//              ${
//                loading || message.type === 'success'
//                  ? 'bg-blue-400 cursor-not-allowed'
//                  : 'bg-blue-600 hover:bg-blue-700'
//              }`}
//          >
//            {loading
//              ? 'Sending...'
//              : message.type === 'success'
//                ? 'Email Sent'
//                : 'Send Magic Link'}
//          </button>
//        </form>

//        <div className="mt-6 text-center">
//          <p className="text-sm text-gray-600">
//            Don't have an account?{' '}
//            <Link
//              href="/pricing"
//              className="font-medium text-blue-600 hover:text-blue-500"
//            >
//              View our plans
//            </Link>
//          </p>
//        </div>
//      </div>
//    </div>
//  )
//}

//'use client';

//import Button from '@/app/components/ui/Button';
//import Link from 'next/link';
//import { signInWithEmail } from '@/app/utils/auth-helpers/server';
//import { handleRequest } from '@/app/utils/auth-helpers/client';
//import { useRouter } from 'next/navigation';
//import { useState } from 'react';

//// Define prop type with allowPassword boolean
//interface EmailSignInProps {
//  allowPassword: boolean;
//  redirectMethod: string;
//  disableButton?: boolean;
//}

//export default function EmailSignIn({
//  allowPassword,
//  redirectMethod,
//  disableButton
//}: EmailSignInProps) {
//  const router = redirectMethod === 'client' ? useRouter() : null;
//  const [isSubmitting, setIsSubmitting] = useState(false);

//  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//    setIsSubmitting(true); // Disable the button while the request is being handled
//    await handleRequest(e, signInWithEmail, router);
//    setIsSubmitting(false);
//  };

//  return (
//    <div className="my-8">
//      <form
//        noValidate={true}
//        className="mb-4"
//        onSubmit={(e) => handleSubmit(e)}
//      >
//        <div className="grid gap-2">
//          <div className="grid gap-1">
//            <label htmlFor="email">Email</label>
//            <input
//              id="email"
//              placeholder="name@example.com"
//              type="email"
//              name="email"
//              autoCapitalize="none"
//              autoComplete="email"
//              autoCorrect="off"
//              className="w-full p-3 rounded-md bg-zinc-800"
//            />
//          </div>
//          <Button
//            variant="slim"
//            type="submit"
//            className="mt-1"
//            loading={isSubmitting}
//            disabled={disableButton}
//          >
//            Sign in
//          </Button>
//        </div>
//      </form>
//      {allowPassword && (
//        <>
//          <p>
//            <Link href="/signin/password_signin" className="font-light text-sm">
//              Sign in with email and password
//            </Link>
//          </p>
//          <p>
//            <Link href="/signin/signup" className="font-light text-sm">
//              Don't have an account? Sign up
//            </Link>
//          </p>
//        </>
//      )}
//    </div>
//  );
//}
