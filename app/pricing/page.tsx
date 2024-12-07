// /app/pricing/page.tsx

import React from 'react';
import Pricing from '@/components/ui/Pricing/Pricing';
import { createClient } from '@/utils/supabase/server';
import {
  getProducts,
  getSubscription,
  getUser
} from '@/utils/supabase/queries';

type PricingPageProps = {
  isMock?: boolean; // Optional prop to determine if mock data should be used
};

export default async function PricingPage({ isMock = false }: PricingPageProps) {
  // If using mock data, return the mock version early.

  // Otherwise, use Supabase to fetch data
  const supabase = createClient();
  const [{ user, error }, products, subscription] = await Promise.all([
    getUser(supabase),
    getProducts(supabase),
    getSubscription(supabase)
  ]);

  // Log any error, but also provide user-facing error handling.
  if (error) {
    console.error('Error fetching user:', error);
    return (
      <div>
        <h2>Error Loading Pricing Information</h2>
        <p>We encountered an error while loading your data. Please try again later.</p>
      </div>
    );
  }

  console.log('user:', user);
  console.log('user details:', user?.user_metadata);

  return (
    <Pricing
      user={user}
      products={products ?? []}
      subscription={subscription}
    />
  );
}