'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
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
      }

      setLoading(false)
    }

    getUser()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Loading your dashboard...</h1>
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md col-span-2">
          <h2 className="text-xl font-semibold mb-4">Welcome, {user?.email}</h2>
          <p className="text-gray-600 mb-4">
            Thank you for subscribing to SourceVerify. Here you can manage your
            account and access your subscription.
          </p>

          <div className="mt-8">
            <h3 className="text-lg font-medium mb-2">Quick Links</h3>
            <div className="space-y-2">
              <Link
                href="/account"
                className="text-blue-600 hover:underline block"
              >
                Account Settings
              </Link>
              <Link
                href="/documents"
                className="text-blue-600 hover:underline block"
              >
                My Documents
              </Link>
              <Link
                href="/support"
                className="text-blue-600 hover:underline block"
              >
                Support
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Subscription Details</h2>
          {subscription ? (
            <div>
              <p className="mb-2">
                <span className="font-medium">Plan:</span>{' '}
                {subscription.prices?.name || 'Standard Plan'}
              </p>
              <p className="mb-2">
                <span className="font-medium">Status:</span>{' '}
                <span
                  className={`capitalize ${subscription.status === 'active' ? 'text-green-600' : 'text-orange-600'}`}
                >
                  {subscription.status}
                </span>
              </p>
              <p className="mb-2">
                <span className="font-medium">Current Period:</span>{' '}
                {new Date(
                  subscription.current_period_start
                ).toLocaleDateString()}{' '}
                to{' '}
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>

              <div className="mt-6">
                <Link
                  href="/account"
                  className="block w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-center rounded transition-colors"
                >
                  Manage Subscription
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-gray-600">No active subscription found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
