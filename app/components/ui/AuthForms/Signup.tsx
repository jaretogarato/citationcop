'use client'

import Button from '@/app/components/ui/Button'
import React from 'react'
import Link from 'next/link'
import { signUp } from '@/app/utils/auth-helpers/server'
import { handleRequest } from '@/app/utils/auth-helpers/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Add the StripeSession interface
interface StripeSession {
  id: string
  customerEmail: string
}

// Update the props interface to include optional stripeSession
interface SignUpProps {
  allowEmail: boolean
  redirectMethod: string
  stripeSession?: StripeSession
}

export default function SignUp({
  allowEmail,
  redirectMethod,
  stripeSession
}: SignUpProps) {
  const router = redirectMethod === 'client' ? useRouter() : null
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitting(true)

    // If we have a stripe session, add it to the form data
    if (stripeSession) {
      const formElement = e.currentTarget
      const formData = new FormData(formElement)
      formData.append('stripeSessionId', stripeSession.id)
    }

    await handleRequest(e, signUp, router)
    setIsSubmitting(false)
  }

  return (
    <div className="my-8">
      <form
        noValidate={true}
        className="mb-4"
        onSubmit={(e) => handleSubmit(e)}
      >
        <div className="grid gap-2">
          <div className="grid gap-1">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              placeholder="name@example.com"
              type="email"
              name="email"
              defaultValue={stripeSession?.customerEmail}
              readOnly={!!stripeSession}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              className={`w-full p-3 rounded-md bg-zinc-800 ${
                stripeSession ? 'opacity-50' : ''
              }`}
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              placeholder="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              className="w-full p-3 rounded-md bg-zinc-800"
            />
          </div>
          <Button
            variant="slim"
            type="submit"
            className="mt-1"
            loading={isSubmitting}
          >
            {stripeSession ? 'Complete Registration' : 'Sign up'}
          </Button>
        </div>
      </form>
      {!stripeSession && (
        <>
          <p>Already have an account?</p>
          <p>
            <Link href="/signin/password_signin" className="font-light text-sm">
              Sign in with email and password
            </Link>
          </p>
          {allowEmail && (
            <p>
              <Link href="/signin/email_signin" className="font-light text-sm">
                Sign in via magic link
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  )
}

//'use client'

//import Button from '@/app/components/ui/Button'
//import React from 'react'
//import Link from 'next/link'
//import { signUp } from '@/app/utils/auth-helpers/server'
//import { handleRequest } from '@/app/utils/auth-helpers/client'
//import { useRouter } from 'next/navigation'
//import { useState } from 'react'

//// Define prop type with allowEmail boolean
//interface SignUpProps {
//  allowEmail: boolean
//  redirectMethod: string
//}

//export default function SignUp({ allowEmail, redirectMethod }: SignUpProps) {
//  const router = redirectMethod === 'client' ? useRouter() : null
//  const [isSubmitting, setIsSubmitting] = useState(false)

//  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//    setIsSubmitting(true) // Disable the button while the request is being handled
//    await handleRequest(e, signUp, router)
//    setIsSubmitting(false)
//  }

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
//            <label htmlFor="password">Password</label>
//            <input
//              id="password"
//              placeholder="Password"
//              type="password"
//              name="password"
//              autoComplete="current-password"
//              className="w-full p-3 rounded-md bg-zinc-800"
//            />
//          </div>
//          <Button
//            variant="slim"
//            type="submit"
//            className="mt-1"
//            loading={isSubmitting}
//          >
//            Sign up
//          </Button>
//        </div>
//      </form>
//      <p>Already have an account?</p>
//      <p>
//        <Link href="/signin/password_signin" className="font-light text-sm">
//          Sign in with email and password
//        </Link>
//      </p>
//      {allowEmail && (
//        <p>
//          <Link href="/signin/email_signin" className="font-light text-sm">
//            Sign in via magic link
//          </Link>
//        </p>
//      )}
//    </div>
//  )
//}
