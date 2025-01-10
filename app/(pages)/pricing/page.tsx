import React from 'react'
import Pricing from '@/app/components/ui/Pricing/Pricing'
//import { User } from '@supabase/supabase-js';
import { createClient } from '@/app/utils/supabase/server'
//import { createClient } from '@/utils/supabase/client';

import {
  getProducts,
  getSubscription
  //getUser
} from '@/app/utils/supabase/queries'

export default async function PricingPage() {
  const supabase = createClient()

  const [products, subscription] = await Promise.all([
    //getUser(supabase),
    getProducts(supabase),
    getSubscription(supabase)
  ])

  //console.log('Products:', products);
  //console.log('Subscription:', subscription);
  console.log('Products with prices:', JSON.stringify(products, null, 2))

  return (
    <Pricing
      //user={user}
      products={products ?? []}
      subscription={subscription}
    />
  )
}

//import React from 'react';
//import Pricing from '@/components/ui/Pricing/Pricing';
//import { createClient } from '@/utils/supabase/server';
//import {
//  getProducts,
//  getSubscription,
//  getUser
//} from '@/utils/supabase/queries';

//type PricingPageProps = {
//  isMock?: boolean; // Optional prop to determine if mock data should be used
//};

//export default async function PricingPage({ isMock = false }: PricingPageProps) {
//  // If using mock data, return the mock version early.

//  // Otherwise, use Supabase to fetch data
//  const supabase = createClient();
//  const [{ user, error }, products, subscription] = await Promise.all([
//    getUser(supabase),
//    getProducts(supabase),
//    getSubscription(supabase)
//  ]);

//  // Log any error, but also provide user-facing error handling.
//  if (error) {
//    console.error('Error fetching user:', error);
//    return (
//      <div>
//        <h2>Error Loading Pricing Information</h2>
//        <p>We encountered an error while loading your data. Please try again later.</p>
//      </div>
//    );
//  }

//  console.log('user:', user);
//  console.log('user details:', user?.user_metadata);

//  return (
//    <Pricing
//      user={user}
//      products={products ?? []}
//      subscription={subscription}
//    />
//  );
//}
