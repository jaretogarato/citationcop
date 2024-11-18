import HomePage from '@/components/verify/HomePage';
import { createClient } from '@/utils/supabase/server';
import Pricing from '@/components/ui/Pricing/Pricing';
import {
  getProducts,
  getSubscription,
  getUser
} from '@/utils/supabase/queries'
import HomePage from '@/components/home-page/HomePage';

export default async function PricingPage() {
  const supabase = createClient();
  const [user, products, subscription] = await Promise.all([
    getUser(supabase),
    getProducts(supabase),
    getSubscription(supabase)
  ]);

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
