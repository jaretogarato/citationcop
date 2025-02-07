'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { createStripePortal } from '@/app/utils/stripe/server'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card'
import Button from '@/app/components/ui/Button'
import type { SubscriptionWithPriceAndProduct } from '@/app/types/supabase/subscription'

interface Props {
  subscription: SubscriptionWithPriceAndProduct | null
}

export default function CustomerPortalForm({ subscription }: Props) {
  const router = useRouter()
  const currentPath = usePathname()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const subscriptionPrice =
    subscription &&
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: subscription?.prices?.currency!,
      minimumFractionDigits: 0
    }).format((subscription?.prices?.unit_amount || 0) / 100)

  const handleStripePortalRequest = async () => {
    setIsSubmitting(true)
    const redirectUrl = await createStripePortal(currentPath)
    setIsSubmitting(false)
    return router.push(redirectUrl)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your Plan</CardTitle>
        <CardDescription>
          {subscription
            ? `You are currently on the ${subscription?.prices?.products?.name} plan.`
            : 'You are not currently subscribed to any plan.'}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="text-xl font-semibold">
          {subscription ? (
            `${subscriptionPrice}/${subscription?.prices?.interval}`
          ) : (
            <Link href="/" className="hover:underline">Choose your plan</Link>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-start justify-between sm:flex-row sm:items-center">
        <p className="pb-4 sm:pb-0">Manage your subscription on Stripe.</p>
        <Button
          variant="slim"
          onClick={handleStripePortalRequest}
          loading={isSubmitting}
        >
          Open customer portal
        </Button>
      </CardFooter>
    </Card>
  )
}