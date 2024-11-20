import Pricing from '@/components/ui/Pricing/Pricing';
import HomePage from '@/components/home-page/HomePage';

export default async function PricingPage() {
  

  //console.log('**** user ***', user);

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
