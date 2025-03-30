// app/components/ui/Pricing/Pricing.tsx
'use client'

import Button from '@/app/components/ui/Button'
import type { Tables } from '@/types_db'
import { getStripe } from '@/app/utils/stripe/client'
import { checkoutWithStripe } from '@/app/utils/stripe/server'
import { getErrorRedirect } from '@/app/utils/helpers'
import { User } from '@supabase/supabase-js'
import cn from 'classnames'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import EmailVerificationStep from './EmailVerificationStep'

type Subscription = Tables<'subscriptions'>
type Product = Tables<'products'>
type Price = Tables<'prices'>
interface ProductWithPrices extends Product {
  prices: Price[]
}
interface PriceWithProduct extends Price {
  products: Product | null
}
interface SubscriptionWithProduct extends Subscription {
  prices: PriceWithProduct | null
}

interface Props {
  products: ProductWithPrices[]
  subscription: SubscriptionWithProduct | null
}

type BillingInterval = 'lifetime' | 'year' | 'month'

export default function Pricing({ products, subscription }: Props) {
  const intervals = Array.from(
    new Set(
      products.flatMap((product) =>
        product?.prices?.map((price) => price?.interval)
      )
    )
  )
  const router = useRouter()
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>('month')
  const [priceIdLoading, setPriceIdLoading] = useState<string>()
  const currentPath = usePathname()

  // New state for email verification step
  const [showEmailStep, setShowEmailStep] = useState(false)
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null)

  const handleStripeCheckout = async (price: Price) => {
    setPriceIdLoading(price.id)

    // Show email verification step instead of proceeding directly to checkout
    setSelectedPrice(price)
    setShowEmailStep(true)
    setPriceIdLoading(undefined)
  }

  const handleEmailVerificationBack = () => {
    setShowEmailStep(false)
    setSelectedPrice(null)
  }

  const handleContinueToCheckout = async (email: string) => {
    if (!selectedPrice) return

    setPriceIdLoading(selectedPrice.id)

    // Store price ID for post-checkout flow
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedPriceId', selectedPrice.id)
      localStorage.setItem('selectedInterval', billingInterval)
      localStorage.setItem('userEmail', email)
    }

    // Add metadata to price object before passing to checkout
    const priceWithMetadata = {
      ...selectedPrice,
      metadata: {
        requires_account: 'true',
        billing_interval: billingInterval,
        email: email // Add email to metadata
      }
    }

    const { errorRedirect, sessionId } = await checkoutWithStripe(
      priceWithMetadata,
      currentPath
    )

    if (errorRedirect) {
      setPriceIdLoading(undefined)
      return router.push(errorRedirect)
    }

    if (!sessionId) {
      setPriceIdLoading(undefined)
      return router.push(
        getErrorRedirect(
          currentPath,
          'An unknown error occurred.',
          'Please try again later or contact a system administrator.'
        )
      )
    }

    const stripe = await getStripe()
    stripe?.redirectToCheckout({ sessionId })

    setPriceIdLoading(undefined)
  }

  if (!products.length) {
    return (
      <section className="bg-black">
        <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8">
          <div className="sm:flex sm:flex-col sm:align-center"></div>
          <p className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
            No subscription pricing plans found. Create them in your{' '}
            <a
              className="text-pink-500 underline"
              href="https://dashboard.stripe.com/products"
              rel="noopener noreferrer"
              target="_blank"
            >
              Stripe Dashboard
            </a>
            .
          </p>
        </div>
      </section>
    )
  }

  // Show email verification step if triggered
  if (showEmailStep && selectedPrice) {
    return (
      <section className="bg-black">
        <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8">
          <EmailVerificationStep
            onBack={handleEmailVerificationBack}
            onContinue={handleContinueToCheckout}
            selectedPrice={selectedPrice}
            billingInterval={billingInterval}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="bg-black">
      <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8">
        <div className="sm:flex sm:flex-col sm:align-center">
          <h1 className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
            Pricing Plans
          </h1>
          <p className="max-w-2xl m-auto mt-5 text-xl text-zinc-200 sm:text-center sm:text-2xl">
            Start verifying references today through an individual or
            organizational plans.
          </p>
          <div className="relative self-center mt-6 bg-zinc-900 rounded-lg p-0.5 flex sm:mt-8 border border-zinc-800">
            {intervals.includes('month') && (
              <button
                onClick={() => setBillingInterval('month')}
                type="button"
                className={`${
                  billingInterval === 'month'
                    ? 'relative w-1/2 bg-zinc-700 border-zinc-800 shadow-sm text-white'
                    : 'ml-0.5 relative w-1/2 border border-transparent text-zinc-400'
                } rounded-md m-1 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 focus:z-10 sm:w-auto sm:px-8`}
              >
                Monthly billing
              </button>
            )}
            {intervals.includes('year') && (
              <button
                onClick={() => setBillingInterval('year')}
                type="button"
                className={`${
                  billingInterval === 'year'
                    ? 'relative w-1/2 bg-zinc-700 border-zinc-800 shadow-sm text-white'
                    : 'ml-0.5 relative w-1/2 border border-transparent text-zinc-400'
                } rounded-md m-1 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 focus:z-10 sm:w-auto sm:px-8`}
              >
                Yearly billing
              </button>
            )}
          </div>
        </div>
        <div className="mt-12 space-y-0 sm:mt-16 flex flex-wrap justify-center gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0">
          {products
            .sort((a, b) => {
              const priceA =
                a?.prices?.find((price) => price.interval === billingInterval)
                  ?.unit_amount || 0
              const priceB =
                b?.prices?.find((price) => price.interval === billingInterval)
                  ?.unit_amount || 0
              return priceA - priceB
            })
            .map((product) => {
              const price = product?.prices?.find(
                (price) => price.interval === billingInterval
              )
              if (!price) return null
              const priceString = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: price.currency!,
                minimumFractionDigits: 0
              }).format((price?.unit_amount || 0) / 100)
              const isTargetProduct =
                product.name === 'Insight' || product.name === 'Journeyman'
              return (
                <div
                  key={product.id}
                  className={cn(
                    'flex flex-col rounded-lg shadow-sm divide-y divide-zinc-600 bg-zinc-900',
                    {
                      'border border-pink-500': subscription
                        ? product.name === subscription?.prices?.products?.name
                        : isTargetProduct
                    },
                    'flex-1',
                    'basis-1/3',
                    'max-w-xs'
                  )}
                >
                  <div className="p-6">
                    <h2 className="text-2xl font-semibold leading-6 text-white">
                      {product.name}
                    </h2>
                    <p className="mt-4 text-zinc-300">{product.description}</p>
                    <p className="mt-8">
                      <span className="text-5xl font-extrabold white">
                        {priceString}
                      </span>
                      <span className="text-base font-medium text-zinc-100">
                        /{billingInterval}
                      </span>
                    </p>
                    <Button
                      variant="slim"
                      type="button"
                      loading={priceIdLoading === price.id}
                      onClick={() => handleStripeCheckout(price)}
                      className="block w-full py-2 mt-8 text-sm font-semibold text-center text-white rounded-md hover:bg-zinc-900"
                    >
                      {subscription ? 'Manage' : 'Subscribe'}
                    </Button>
                    {(subscription
                      ? product.name === subscription?.prices?.products?.name
                      : isTargetProduct) && (
                      <p className="mt-2 text-base font-medium text-pink-500 text-center">
                        Most Popular
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
        <div className="py-16"></div>
      </div>
    </section>
  )
}

// Email verification step component
//function EmailVerificationStep({
//  onBack,
//  onContinue,
//  selectedPrice,
//  billingInterval
//}: {
//  onBack: () => void
//  onContinue: (email: string) => void
//  selectedPrice: Price
//  billingInterval: BillingInterval
//}) {
//  const [email, setEmail] = useState('')
//  const [loading, setLoading] = useState(false)
//  const [error, setError] = useState<string | null>(null)

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

//      // Check if user exists
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
//        const priceWithMetadata = {
//          ...selectedPrice,
//          metadata: {
//            requires_account: 'true',
//            billing_interval: billingInterval
//          }
//        }

//        // Store the price info for after sign-in
//        if (typeof window !== 'undefined') {
//          localStorage.setItem('selectedPriceId', selectedPrice.id)
//          localStorage.setItem('selectedInterval', billingInterval)
//          localStorage.setItem('userEmail', email)
//        }

//        // Redirect to sign in page
//        window.location.href = `/signin?subscription_started=true&email=${encodeURIComponent(email)}`
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
//    <div className="max-w-md mx-auto p-6 bg-zinc-900 rounded-lg shadow-md border border-zinc-800">
//      <h2 className="text-2xl font-bold mb-6 text-white">Confirm your email</h2>
//      <p className="mb-4 text-zinc-300">
//        Please enter your email address to continue with your subscription.
//      </p>

//      <form onSubmit={handleSubmit}>
//        <div className="mb-4">
//          <label
//            htmlFor="email"
//            className="block text-sm font-medium text-zinc-300 mb-1"
//          >
//            Email address
//          </label>
//          <input
//            id="email"
//            type="email"
//            value={email}
//            onChange={(e) => setEmail(e.target.value)}
//            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 text-white"
//            placeholder="you@example.com"
//            required
//          />
//        </div>

//        {error && (
//          <div className="mb-4 p-2 text-sm text-red-400 bg-red-900 bg-opacity-30 rounded-md">
//            {error}
//          </div>
//        )}

//        <div className="flex space-x-3">
//          <button
//            type="button"
//            onClick={onBack}
//            className="flex-1 py-2 px-4 border border-zinc-700 rounded-md shadow-sm text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50"
//          >
//            Back
//          </button>
//          <button
//            type="submit"
//            disabled={loading}
//            className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 disabled:opacity-50"
//          >
//            {loading ? 'Checking...' : 'Continue'}
//          </button>
//        </div>
//      </form>
//    </div>
//  )
//}

//'use client'

//import Button from '@/app/components/ui/Button'
//import type { Tables } from '@/types_db'
//import { getStripe } from '@/app/utils/stripe/client'
//import { checkoutWithStripe } from '@/app/utils/stripe/server'
//import { getErrorRedirect } from '@/app/utils/helpers'
//import { User } from '@supabase/supabase-js'
//import cn from 'classnames'
//import { useRouter, usePathname } from 'next/navigation'
//import { useState } from 'react'

//type Subscription = Tables<'subscriptions'>
//type Product = Tables<'products'>
//type Price = Tables<'prices'>
//interface ProductWithPrices extends Product {
//  prices: Price[]
//}
//interface PriceWithProduct extends Price {
//  products: Product | null
//}
//interface SubscriptionWithProduct extends Subscription {
//  prices: PriceWithProduct | null
//}

//interface Props {
//  products: ProductWithPrices[]
//  subscription: SubscriptionWithProduct | null
//}

//type BillingInterval = 'lifetime' | 'year' | 'month'

//export default function Pricing({ products, subscription }: Props) {
//  const intervals = Array.from(
//    new Set(
//      products.flatMap((product) =>
//        product?.prices?.map((price) => price?.interval)
//      )
//    )
//  )
//  const router = useRouter()
//  const [billingInterval, setBillingInterval] =
//    useState<BillingInterval>('month')
//  const [priceIdLoading, setPriceIdLoading] = useState<string>()
//  const currentPath = usePathname()

//  const handleStripeCheckout = async (price: Price) => {
//    setPriceIdLoading(price.id)

//    // Store price ID for post-checkout flow
//    if (typeof window !== 'undefined') {
//      localStorage.setItem('selectedPriceId', price.id)
//      localStorage.setItem('selectedInterval', billingInterval)
//    }

//    // Add metadata to price object before passing to checkout
//    const priceWithMetadata = {
//      ...price,
//      metadata: {
//        requires_account: 'true',
//        billing_interval: billingInterval
//      }
//    }

//    const { errorRedirect, sessionId } = await checkoutWithStripe(
//      priceWithMetadata,
//      currentPath
//    )

//    if (errorRedirect) {
//      setPriceIdLoading(undefined)
//      return router.push(errorRedirect)
//    }

//    if (!sessionId) {
//      setPriceIdLoading(undefined)
//      return router.push(
//        getErrorRedirect(
//          currentPath,
//          'An unknown error occurred.',
//          'Please try again later or contact a system administrator.'
//        )
//      )
//    }

//    const stripe = await getStripe()
//    stripe?.redirectToCheckout({ sessionId })

//    setPriceIdLoading(undefined)
//  }

//  if (!products.length) {
//    return (
//      <section className="bg-black">
//        <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8">
//          <div className="sm:flex sm:flex-col sm:align-center"></div>
//          <p className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
//            No subscription pricing plans found. Create them in your{' '}
//            <a
//              className="text-pink-500 underline"
//              href="https://dashboard.stripe.com/products"
//              rel="noopener noreferrer"
//              target="_blank"
//            >
//              Stripe Dashboard
//            </a>
//            .
//          </p>
//        </div>
//      </section>
//    )
//  }

//  return (
//    <section className="bg-black">
//      <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8">
//        <div className="sm:flex sm:flex-col sm:align-center">
//          <h1 className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
//            Pricing Plans
//          </h1>
//          <p className="max-w-2xl m-auto mt-5 text-xl text-zinc-200 sm:text-center sm:text-2xl">
//            Start verifying references today through an individual or
//            organizational plans.
//          </p>
//          <div className="relative self-center mt-6 bg-zinc-900 rounded-lg p-0.5 flex sm:mt-8 border border-zinc-800">
//            {intervals.includes('month') && (
//              <button
//                onClick={() => setBillingInterval('month')}
//                type="button"
//                className={`${
//                  billingInterval === 'month'
//                    ? 'relative w-1/2 bg-zinc-700 border-zinc-800 shadow-sm text-white'
//                    : 'ml-0.5 relative w-1/2 border border-transparent text-zinc-400'
//                } rounded-md m-1 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 focus:z-10 sm:w-auto sm:px-8`}
//              >
//                Monthly billing
//              </button>
//            )}
//            {intervals.includes('year') && (
//              <button
//                onClick={() => setBillingInterval('year')}
//                type="button"
//                className={`${
//                  billingInterval === 'year'
//                    ? 'relative w-1/2 bg-zinc-700 border-zinc-800 shadow-sm text-white'
//                    : 'ml-0.5 relative w-1/2 border border-transparent text-zinc-400'
//                } rounded-md m-1 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 focus:z-10 sm:w-auto sm:px-8`}
//              >
//                Yearly billing
//              </button>
//            )}
//          </div>
//        </div>
//        <div className="mt-12 space-y-0 sm:mt-16 flex flex-wrap justify-center gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0">
//          {products
//            .sort((a, b) => {
//              const priceA =
//                a?.prices?.find((price) => price.interval === billingInterval)
//                  ?.unit_amount || 0
//              const priceB =
//                b?.prices?.find((price) => price.interval === billingInterval)
//                  ?.unit_amount || 0
//              return priceA - priceB
//            })
//            .map((product) => {
//              const price = product?.prices?.find(
//                (price) => price.interval === billingInterval
//              )
//              if (!price) return null
//              const priceString = new Intl.NumberFormat('en-US', {
//                style: 'currency',
//                currency: price.currency!,
//                minimumFractionDigits: 0
//              }).format((price?.unit_amount || 0) / 100)
//              const isTargetProduct =
//                product.name === 'Insight' || product.name === 'Journeyman'
//              return (
//                <div
//                  key={product.id}
//                  className={cn(
//                    'flex flex-col rounded-lg shadow-sm divide-y divide-zinc-600 bg-zinc-900',
//                    {
//                      'border border-pink-500': subscription
//                        ? product.name === subscription?.prices?.products?.name
//                        : isTargetProduct
//                    },
//                    'flex-1',
//                    'basis-1/3',
//                    'max-w-xs'
//                  )}
//                >
//                  <div className="p-6">
//                    <h2 className="text-2xl font-semibold leading-6 text-white">
//                      {product.name}
//                    </h2>
//                    <p className="mt-4 text-zinc-300">{product.description}</p>
//                    <p className="mt-8">
//                      <span className="text-5xl font-extrabold white">
//                        {priceString}
//                      </span>
//                      <span className="text-base font-medium text-zinc-100">
//                        /{billingInterval}
//                      </span>
//                    </p>
//                    <Button
//                      variant="slim"
//                      type="button"
//                      loading={priceIdLoading === price.id}
//                      onClick={() => handleStripeCheckout(price)}
//                      className="block w-full py-2 mt-8 text-sm font-semibold text-center text-white rounded-md hover:bg-zinc-900"
//                    >
//                      {subscription ? 'Manage' : 'Subscribe'}
//                    </Button>
//                    {(subscription
//                      ? product.name === subscription?.prices?.products?.name
//                      : isTargetProduct) && (
//                      <p className="mt-2 text-base font-medium text-pink-500 text-center">
//                        Most Popular
//                      </p>
//                    )}
//                  </div>
//                </div>
//              )
//            })}
//        </div>
//        <div className="py-16"></div>
//      </div>
//    </section>
//  )
//}

//'use client'

//import Button from '@/app/components/ui/Button'
////import LogoCloud from '@/components/ui/LogoCloud';
//import type { Tables } from '@/types_db'
//import { getStripe } from '@/app/utils/stripe/client'
//import { checkoutWithStripe } from '@/app/utils/stripe/server'
//import { getErrorRedirect } from '@/app/utils/helpers'
//import { User } from '@supabase/supabase-js'
//import cn from 'classnames'
//import { useRouter, usePathname } from 'next/navigation'
//import { useState } from 'react'

//type Subscription = Tables<'subscriptions'>
//type Product = Tables<'products'>
//type Price = Tables<'prices'>
//interface ProductWithPrices extends Product {
//  prices: Price[]
//}
//interface PriceWithProduct extends Price {
//  products: Product | null
//}
//interface SubscriptionWithProduct extends Subscription {
//  prices: PriceWithProduct | null
//}

//interface Props {
//  //user: User | null | undefined;
//  products: ProductWithPrices[]
//  subscription: SubscriptionWithProduct | null
//}

//type BillingInterval = 'lifetime' | 'year' | 'month'

////export default function Pricing({ user, products, subscription }: Props) {
//export default function Pricing({ products, subscription }: Props) {
//  const intervals = Array.from(
//    new Set(
//      products.flatMap((product) =>
//        product?.prices?.map((price) => price?.interval)
//      )
//    )
//  )
//  const router = useRouter()
//  const [billingInterval, setBillingInterval] =
//    useState<BillingInterval>('month')
//  const [priceIdLoading, setPriceIdLoading] = useState<string>()
//  const currentPath = usePathname()

//  const handleStripeCheckout = async (price: Price) => {
//    setPriceIdLoading(price.id)

//    //if (!user) {
//    //  setPriceIdLoading(undefined);
//    //  return router.push('/signin/signup');
//    //}

//    const { errorRedirect, sessionId } = await checkoutWithStripe(
//      price,
//      currentPath
//    )

//    if (errorRedirect) {
//      setPriceIdLoading(undefined)
//      return router.push(errorRedirect)
//    }

//    if (!sessionId) {
//      setPriceIdLoading(undefined)
//      return router.push(
//        getErrorRedirect(
//          currentPath,
//          'An unknown error occurred.',
//          'Please try again later or contact a system administrator.'
//        )
//      )
//    }

//    const stripe = await getStripe()
//    stripe?.redirectToCheckout({ sessionId })

//    setPriceIdLoading(undefined)
//  }

//  if (!products.length) {
//    return (
//      <section className="bg-black">
//        <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8">
//          <div className="sm:flex sm:flex-col sm:align-center"></div>
//          <p className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
//            No subscription pricing plans found. Create them in your{' '}
//            <a
//              className="text-pink-500 underline"
//              href="https://dashboard.stripe.com/products"
//              rel="noopener noreferrer"
//              target="_blank"
//            >
//              Stripe Dashboard
//            </a>
//            .
//          </p>
//        </div>
//        {/* <LogoCloud />*/}
//      </section>
//    )
//  } else {
//    return (
//      <section className="bg-black">
//        <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8">
//          <div className="sm:flex sm:flex-col sm:align-center">
//            <h1 className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
//              Pricing Plans
//            </h1>
//            <p className="max-w-2xl m-auto mt-5 text-xl text-zinc-200 sm:text-center sm:text-2xl">
//              Start verifying references today through an individual or
//              organizational plans.
//            </p>
//            <div className="relative self-center mt-6 bg-zinc-900 rounded-lg p-0.5 flex sm:mt-8 border border-zinc-800">
//              {intervals.includes('month') && (
//                <button
//                  onClick={() => setBillingInterval('month')}
//                  type="button"
//                  className={`${
//                    billingInterval === 'month'
//                      ? 'relative w-1/2 bg-zinc-700 border-zinc-800 shadow-sm text-white'
//                      : 'ml-0.5 relative w-1/2 border border-transparent text-zinc-400'
//                  } rounded-md m-1 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 focus:z-10 sm:w-auto sm:px-8`}
//                >
//                  Monthly billing
//                </button>
//              )}
//              {intervals.includes('year') && (
//                <button
//                  onClick={() => setBillingInterval('year')}
//                  type="button"
//                  className={`${
//                    billingInterval === 'year'
//                      ? 'relative w-1/2 bg-zinc-700 border-zinc-800 shadow-sm text-white'
//                      : 'ml-0.5 relative w-1/2 border border-transparent text-zinc-400'
//                  } rounded-md m-1 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 focus:z-10 sm:w-auto sm:px-8`}
//                >
//                  Yearly billing
//                </button>
//              )}
//            </div>
//          </div>
//          <div className="mt-12 space-y-0 sm:mt-16 flex flex-wrap justify-center gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0">
//            {products
//              .sort((a, b) => {
//                const priceA =
//                  a?.prices?.find((price) => price.interval === billingInterval)
//                    ?.unit_amount || 0
//                const priceB =
//                  b?.prices?.find((price) => price.interval === billingInterval)
//                    ?.unit_amount || 0
//                return priceA - priceB // Ascending order
//              })
//              .map((product) => {
//                const price = product?.prices?.find(
//                  (price) => price.interval === billingInterval
//                )
//                if (!price) return null
//                const priceString = new Intl.NumberFormat('en-US', {
//                  style: 'currency',
//                  currency: price.currency!,
//                  minimumFractionDigits: 0
//                }).format((price?.unit_amount || 0) / 100)
//                const isTargetProduct =
//                  product.name === 'Insight' || product.name === 'Journeyman'
//                return (
//                  <div
//                    key={product.id}
//                    className={cn(
//                      'flex flex-col rounded-lg shadow-sm divide-y divide-zinc-600 bg-zinc-900',
//                      {
//                        'border border-pink-500': subscription
//                          ? product.name ===
//                            subscription?.prices?.products?.name
//                          : isTargetProduct
//                      },
//                      'flex-1',
//                      'basis-1/3',
//                      'max-w-xs'
//                    )}
//                  >
//                    <div className="p-6">
//                      <h2 className="text-2xl font-semibold leading-6 text-white">
//                        {product.name}
//                      </h2>
//                      <p className="mt-4 text-zinc-300">
//                        {product.description}
//                      </p>
//                      <p className="mt-8">
//                        <span className="text-5xl font-extrabold white">
//                          {priceString}
//                        </span>
//                        <span className="text-base font-medium text-zinc-100">
//                          /{billingInterval}
//                        </span>
//                      </p>
//                      <Button
//                        variant="slim"
//                        type="button"
//                        loading={priceIdLoading === price.id}
//                        onClick={() => handleStripeCheckout(price)}
//                        className="block w-full py-2 mt-8 text-sm font-semibold text-center text-white rounded-md hover:bg-zinc-900"
//                      >
//                        {subscription ? 'Manage' : 'Subscribe'}
//                      </Button>
//                      {(subscription
//                        ? product.name === subscription?.prices?.products?.name
//                        : isTargetProduct) && (
//                        <p className="mt-2 text-base font-medium text-pink-500 text-center">
//                          Most Popular
//                        </p>
//                      )}
//                    </div>
//                  </div>
//                )
//              })}
//          </div>
//          {/*<LogoCloud />*/}
//          <br />
//          <br />
//          <br />
//          <br />
//          <br />
//        </div>
//      </section>
//    )
//  }
//}
