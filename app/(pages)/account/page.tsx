import CustomerPortalForm from '@/app/components/ui/AccountForms/CustomerPortalForm'
import EmailForm from '@/app/components/ui/AccountForms/EmailForm'
import NameForm from '@/app/components/ui/AccountForms/NameForm'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/utils/supabase/server'
import {
  getUserDetails,
  getSubscriptionWithPriceAndProduct,
  getUser
} from '@/app/utils/supabase/queries'
import { UserDetailsResponse, UserDetails } from '@/app/types/supabase/user'

export default async function Account() {
  const supabase = createClient()
  
  // Fetch data concurrently
  const [userResponse, userDetailsResponse, subscription]: [
    { user: any } | null,
    UserDetailsResponse,
    any
  ] = await Promise.all([
    getUser(supabase),
    getUserDetails(supabase),
    getSubscriptionWithPriceAndProduct(supabase)
  ])

  // Ensure `user` data is available, otherwise redirect to /signin
  const user = userResponse?.user ?? null
  if (!user) {
    redirect('/signin')
    return null
  }

  // Ensure `userDetails` data is available
  const userDetails: UserDetails | null = userDetailsResponse?.data ?? null

  return (
    <section className="mb-32 bg-black">
      <div className="max-w-6xl px-4 py-8 mx-auto sm:px-6 sm:pt-24 lg:px-8">
        <div className="sm:align-center sm:flex sm:flex-col">
          <h1 className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
            Account
          </h1>
          <p className="max-w-2xl m-auto mt-5 text-xl text-zinc-200 sm:text-center sm:text-2xl">
            We partnered with Stripe for a simplified billing.
          </p>
        </div>
      </div>
      <div className="p-4">
        <CustomerPortalForm subscription={subscription} />
        <NameForm userName={userDetails?.full_name ?? ''} />
        {user.email && <EmailForm userEmail={user.email} />}
      </div>
    </section>
  )
}
