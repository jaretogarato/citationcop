import { createClient } from '@/utils/supabase/server';
import Pricing from '@/components/ui/Pricing/Pricing';
import {
  getProducts,
  getSubscription,
  getUser,
  getUserDetails
} from '@/utils/supabase/queries'
import HomePage from '@/components/home-page/HomePage';

export default async function PricingPage() {
  const supabase = createClient();

  const [{ user }, products, subscription, userDetailsResponse] = await Promise.all([
    getUser(supabase),
    getProducts(supabase),
    getSubscription(supabase),
    getUserDetails(supabase),
  ]);

  // Safely extract user details data, handling the possibility of null values
  const userName = userDetailsResponse?.data?.full_name ?? '';
  const userEmail = user?.email ?? '';

  console.log('**** user ***', user);
  console.log('**** userDetails ***', userDetailsResponse);

  //const supabase = createClient();
  //const [user, products, subscription] = await Promise.all([
  //  getUser(supabase),
  //  getProducts(supabase),
  //  getSubscription(supabase)
  //]);

  return (
    <>
      <HomePage />
      <Pricing
        user={user}
        products={products ?? []}
        subscription={subscription}
      />
    </>
    //<Pricing
    //  user={user}
    //  products={products ?? []}
    //  subscription={subscription}
    ///>
  );
}
