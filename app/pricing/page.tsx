// /app/pricing/page.tsx

import React from 'react';
import Pricing from '@/components/ui/Pricing/Pricing';
//import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

import {
  getProducts,
  getSubscription,
  getUser
} from '@/utils/supabase/queries';

export default async function PricingPage() {
  const supabase = createClient();
  const [user, products, subscription] = await Promise.all([
    getUser(supabase),
    getProducts(supabase),
    getSubscription(supabase)
  ]);

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

//const PricingPage = () => {
//  // Mock data for testing
//  const mockUser: User | null = {
//    id: 'user123',
//    app_metadata: {},
//    user_metadata: {},
//    aud: 'authenticated',
//    created_at: new Date().toISOString()
//  };

//  const mockProducts: ProductWithPrices[] = [
//		{
//			id: 'product1',
//			name: 'Basic Plan',
//			description: 'Great for individuals starting out.',
//			active: true, // Assuming the product is active
//			image: '/images/basic-plan.png', // Replace with a valid image URL or null if none
//			metadata: {}, // Replace with actual metadata if applicable
//			prices: [
//				{
//					id: 'price1',
//					interval: 'month',
//					currency: 'USD',
//					unit_amount: 5000,
//					active: true, // Assuming the price is active
//					metadata: {}, // Replace with actual metadata if applicable
//					products: null, // Add this if the type requires it
//				},
//				{
//					id: 'price2',
//					interval: 'year',
//					currency: 'USD',
//					unit_amount: 50000,
//					active: true,
//					metadata: {},
//					products: null,
//				},
//			],
//		},
//		{
//			id: 'product2',
//			name: 'Pro Plan',
//			description: 'Perfect for professionals.',
//			active: true,
//			image: '/images/pro-plan.png',
//			metadata: {},
//			prices: [
//				{
//					id: 'price3',
//					interval: 'month',
//					currency: 'USD',
//					unit_amount: 10000,
//					active: true,
//					metadata: {},
//					products: null,
//				},
//				{
//					id: 'price4',
//					interval: 'year',
//					currency: 'USD',
//					unit_amount: 100000,
//					active: true,
//					metadata: {},
//					products: null,
//				},
//			],
//		},
//	];

//  const mockSubscription = {
//    id: 'subscription1',
//    prices: {
//      id: 'price1',
//      interval: 'month',
//      currency: 'USD',
//      unit_amount: 5000,
//      products: {
//        id: 'product1',
//        name: 'Basic Plan'
//      }
//    }
//  };

//  return (
//    <Pricing
//      user={mockUser}
//      products={mockProducts}
//      subscription={mockSubscription}
//    />
//  );
//};

//export default PricingPage;
