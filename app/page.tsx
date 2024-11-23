import { createClient } from '@/utils/supabase/server';
import Pricing from '@/components/ui/Pricing/Pricing';
import {
  getProducts,
  getSubscription,
  getUser,
  getUserDetails
} from '@/utils/supabase/queries';
import HomePage from '@/components/home-page/HomePage';
import { UserDetailsResponse, GetUserResponse } from '@/types/user'; 

export default async function Home() {
  const supabase = createClient();

  // Fetch data concurrently using Promise.all
  const [userResponse, products, subscription, userDetailsResponse]: [
    GetUserResponse,
    any,
    any,
    UserDetailsResponse
  ] = await Promise.all([
    getUser(supabase),
    getProducts(supabase),
    getSubscription(supabase),
    getUserDetails(supabase),
  ]);

  // Extract user and userDetails safely
  const user = userResponse?.user ?? null;
  const userDetails = userDetailsResponse?.data ?? null;

  // Safe fallback to empty values
  const userName = userDetails?.full_name ?? '';
  const userEmail = user?.email ?? '';

  console.log('**** user ***', user);
  console.log('**** userDetails ***', userDetailsResponse);

  return (
    <>
      <HomePage />
      <Pricing
        user={user}
        products={products ?? []}
        subscription={subscription}
      />
    </>
  );
}
