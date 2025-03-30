'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import Button from '@/app/components/ui/Button'
import { useRouter, useSearchParams } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false)
  const supabase = createClientComponentClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    // Check if redirected from successful subscription
    if (searchParams?.get('subscription_success') === 'true') {
      setSubscriptionSuccess(true)
    }

    const getUser = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!session) {
        window.location.href = '/signin'
        return
      }

      setUser(session.user)

      // Fetch subscription details
      const { data: subscriptionData, error } = await supabase
        .from('subscriptions')
        .select('*, prices(*)')
        .eq('user_id', session.user.id)
        .single()

      if (subscriptionData) {
        setSubscription(subscriptionData)
      } else if (error) {
        console.error('Error fetching subscription:', error)
      }

      setLoading(false)
    }

    getUser()
  }, [searchParams])

  const handleManageSubscription = () => {
    router.push('/pricing')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-8 bg-white rounded-lg shadow-md dark:bg-gray-800 dark:text-white">
          <h1 className="text-2xl font-bold mb-4">Loading your dashboard...</h1>
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {subscriptionSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg dark:bg-green-900 dark:border-green-800 dark:text-green-200">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              ></path>
            </svg>
            <p className="font-medium">
              Subscription process completed successfully!
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md col-span-2 dark:bg-gray-800 dark:text-white">
          <h2 className="text-xl font-semibold mb-4">Welcome, {user?.email}</h2>
          <p className="text-gray-600 mb-4 dark:text-gray-300">
            Thank you for subscribing to SourceVerify. Here you can manage your
            account and access your subscription.
          </p>

          <div className="mt-8">
            <h3 className="text-lg font-medium mb-2">Quick Links</h3>
            <div className="space-y-2">
              <Link
                href="/account"
                className="text-blue-600 hover:underline block dark:text-blue-400"
              >
                Account Settings
              </Link>
              <Link
                href="/documents"
                className="text-blue-600 hover:underline block dark:text-blue-400"
              >
                My Documents
              </Link>
              <Link
                href="/support"
                className="text-blue-600 hover:underline block dark:text-blue-400"
              >
                Support
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md dark:bg-gray-800 dark:text-white">
          <h2 className="text-xl font-semibold mb-4">Subscription Details</h2>
          {subscription ? (
            <div>
              <p className="mb-2">
                <span className="font-medium">Plan:</span>{' '}
                {subscription.prices?.products?.name ||
                  subscription.prices?.name ||
                  'Standard Plan'}
              </p>
              <p className="mb-2">
                <span className="font-medium">Status:</span>{' '}
                <span
                  className={`inline-flex items-center capitalize ${
                    subscription.status === 'active'
                      ? 'text-green-600 dark:text-green-400'
                      : subscription.status === 'trialing'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-orange-600 dark:text-orange-400'
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full mr-2 ${
                      subscription.status === 'active'
                        ? 'bg-green-500'
                        : subscription.status === 'trialing'
                          ? 'bg-blue-500'
                          : 'bg-orange-500'
                    }`}
                  ></span>
                  {subscription.status}
                </span>
              </p>

              {subscription.current_period_start &&
                subscription.current_period_end && (
                  <p className="mb-2">
                    <span className="font-medium">Current Period:</span>{' '}
                    {new Date(
                      subscription.current_period_start
                    ).toLocaleDateString()}{' '}
                    to{' '}
                    {new Date(
                      subscription.current_period_end
                    ).toLocaleDateString()}
                  </p>
                )}

              {subscription.prices?.unit_amount && (
                <p className="mb-4">
                  <span className="font-medium">Price:</span>{' '}
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: subscription.prices.currency || 'USD',
                    minimumFractionDigits: 2
                  }).format((subscription.prices.unit_amount || 0) / 100)}{' '}
                  / {subscription.prices.interval || 'month'}
                </p>
              )}

              <div className="mt-6">
                <Button
                  onClick={handleManageSubscription}
                  className="block w-full"
                >
                  {subscription.status === 'active'
                    ? 'Manage Subscription'
                    : 'View Plans'}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4 dark:text-gray-300">
                You don't have an active subscription yet.
              </p>
              <Button
                onClick={handleManageSubscription}
                className="block w-full"
              >
                Choose a Plan
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

//'use client'

//import { useEffect, useState } from 'react'
//import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
//import Link from 'next/link'

//export default function Dashboard() {
//  const [user, setUser] = useState<any>(null)
//  const [subscription, setSubscription] = useState<any>(null)
//  const [loading, setLoading] = useState(true)
//  const supabase = createClientComponentClient()

//  useEffect(() => {
//    const getUser = async () => {
//      const {
//        data: { session }
//      } = await supabase.auth.getSession()

//      if (!session) {
//        window.location.href = '/signin'
//        return
//      }

//      setUser(session.user)

//      // Fetch subscription details
//      const { data: subscriptionData, error } = await supabase
//        .from('subscriptions')
//        .select('*, prices(*)')
//        .eq('user_id', session.user.id)
//        .single()

//      if (subscriptionData) {
//        setSubscription(subscriptionData)
//      }

//      setLoading(false)
//    }

//    getUser()
//  }, [])

//  if (loading) {
//    return (
//      <div className="min-h-screen flex items-center justify-center">
//        <div className="p-8 bg-white rounded-lg shadow-md">
//          <h1 className="text-2xl font-bold mb-4">Loading your dashboard...</h1>
//          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
//        </div>
//      </div>
//    )
//  }

//  return (
//    <div className="max-w-6xl mx-auto px-4 py-8">
//      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

//      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//        <div className="bg-white p-6 rounded-lg shadow-md col-span-2">
//          <h2 className="text-xl font-semibold mb-4">Welcome, {user?.email}</h2>
//          <p className="text-gray-600 mb-4">
//            Thank you for subscribing to SourceVerify. Here you can manage your
//            account and access your subscription.
//          </p>

//          <div className="mt-8">
//            <h3 className="text-lg font-medium mb-2">Quick Links</h3>
//            <div className="space-y-2">
//              <Link
//                href="/account"
//                className="text-blue-600 hover:underline block"
//              >
//                Account Settings
//              </Link>
//              <Link
//                href="/documents"
//                className="text-blue-600 hover:underline block"
//              >
//                My Documents
//              </Link>
//              <Link
//                href="/support"
//                className="text-blue-600 hover:underline block"
//              >
//                Support
//              </Link>
//            </div>
//          </div>
//        </div>

//        <div className="bg-white p-6 rounded-lg shadow-md">
//          <h2 className="text-xl font-semibold mb-4">Subscription Details</h2>
//          {subscription ? (
//            <div>
//              <p className="mb-2">
//                <span className="font-medium">Plan:</span>{' '}
//                {subscription.prices?.name || 'Standard Plan'}
//              </p>
//              <p className="mb-2">
//                <span className="font-medium">Status:</span>{' '}
//                <span
//                  className={`capitalize ${subscription.status === 'active' ? 'text-green-600' : 'text-orange-600'}`}
//                >
//                  {subscription.status}
//                </span>
//              </p>
//              <p className="mb-2">
//                <span className="font-medium">Current Period:</span>{' '}
//                {new Date(
//                  subscription.current_period_start
//                ).toLocaleDateString()}{' '}
//                to{' '}
//                {new Date(subscription.current_period_end).toLocaleDateString()}
//              </p>

//              <div className="mt-6">
//                <Link
//                  href="/account"
//                  className="block w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-center rounded transition-colors"
//                >
//                  Manage Subscription
//                </Link>
//              </div>
//            </div>
//          ) : (
//            <p className="text-gray-600">No active subscription found.</p>
//          )}
//        </div>
//      </div>
//    </div>
//  )
//}
