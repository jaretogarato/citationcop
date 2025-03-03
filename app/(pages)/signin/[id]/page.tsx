import Logo from '@/app/components/icons/Logo'
import { createClient } from '@/app/utils/supabase/client'
import { stripe } from '@/app/utils/stripe/config'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getAuthTypes,
  getViewTypes,
  getDefaultSignInView,
  getRedirectMethod
} from '@/app/utils/auth-helpers/settings'
import { Card } from '@/app/components/ui/card'
import PasswordSignIn from '@/app/components/ui/AuthForms/PasswordSignIn'
import EmailSignIn from '@/app/components/ui/AuthForms/EmailSignIn'
import Separator from '@/app/components/ui/AuthForms/Separator'
import OauthSignIn from '@/app/components/ui/AuthForms/OauthSignIn'
import ForgotPassword from '@/app/components/ui/AuthForms/ForgotPassword'
import UpdatePassword from '@/app/components/ui/AuthForms/UpdatePassword'
import SignUp from '@/app/components/ui/AuthForms/Signup'

export default async function SignIn({
  params,
  searchParams
}: {
  params: { id: string }
  searchParams: {
    disable_button: boolean
    session_id?: string
  }
}) {
  const { allowOauth, allowEmail, allowPassword } = getAuthTypes()
  const viewTypes = getViewTypes()
  const redirectMethod = getRedirectMethod()

  // Handle Stripe checkout session if present
  let stripeSession
  if (searchParams.session_id && params.id === 'signup') {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        searchParams.session_id
      )
      if (session.customer_details?.email) {
        stripeSession = {
          id: session.id,
          customerEmail: session.customer_details.email
        }
      }
    } catch (error) {
      console.error('Error retrieving checkout session:', error)
      return redirect('/pricing')
    }
  }

  // Declare 'viewProp' and initialize with the default value
  let viewProp: string

  // Assign url id to 'viewProp' if it's a valid string and ViewTypes includes it
  if (typeof params.id === 'string' && viewTypes.includes(params.id)) {
    viewProp = params.id
  } else {
    const preferredSignInView =
      cookies().get('preferredSignInView')?.value || null
    viewProp = getDefaultSignInView(preferredSignInView)
    return redirect(`/signin/${viewProp}`)
  }

  // Check if the user is already logged in and redirect to the account page if so
  const supabase = createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (user && viewProp !== 'update_password') {
    return redirect('/')
  } else if (!user && viewProp === 'update_password') {
    return redirect('/signin')
  }

  return (
    <div className="flex justify-center height-screen-helper">
      <div className="flex flex-col justify-between max-w-lg p-3 m-auto w-80 ">
        <div className="flex justify-center pb-12 ">
          <Logo width="64px" height="64px" />
        </div>
        <Card
          title={
            viewProp === 'forgot_password'
              ? 'Reset Password'
              : viewProp === 'update_password'
                ? 'Update Password'
                : viewProp === 'signup'
                  ? stripeSession
                    ? 'Complete Your Registration'
                    : 'Sign Up'
                  : 'Sign In'
          }
        >
          {viewProp === 'password_signin' && (
            <PasswordSignIn
              allowEmail={allowEmail}
              redirectMethod={redirectMethod}
            />
          )}
          {viewProp === 'email_signin' && (
            <EmailSignIn
              allowPassword={allowPassword}
              redirectMethod={redirectMethod}
              disableButton={searchParams.disable_button}
            />
          )}
          {viewProp === 'forgot_password' && (
            <ForgotPassword
              allowEmail={allowEmail}
              redirectMethod={redirectMethod}
              disableButton={searchParams.disable_button}
            />
          )}
          {viewProp === 'update_password' && (
            <UpdatePassword redirectMethod={redirectMethod} />
          )}
          {viewProp === 'signup' && (
            <SignUp
              allowEmail={allowEmail}
              redirectMethod={redirectMethod}
              stripeSession={stripeSession}
            />
          )}
          {viewProp !== 'update_password' &&
            viewProp !== 'signup' &&
            allowOauth && (
              <>
                <Separator text="Third-party sign-in" />
                <OauthSignIn />
              </>
            )}
        </Card>
      </div>
    </div>
  )
}

//import Logo from '@/app/components/icons/Logo'
////import { createClient } from '@/utils/supabase/server';
//import { createClient } from '@/app/utils/supabase/client'
//import { cookies } from 'next/headers'
//import { redirect } from 'next/navigation'
//import {
//  getAuthTypes,
//  getViewTypes,
//  getDefaultSignInView,
//  getRedirectMethod
//} from '@/app/utils/auth-helpers/settings'
//import { Card } from '@/app/components/ui/card'
//import PasswordSignIn from '@/app/components/ui/AuthForms/PasswordSignIn'
//import EmailSignIn from '@/app/components/ui/AuthForms/EmailSignIn'
//import Separator from '@/app/components/ui/AuthForms/Separator'
//import OauthSignIn from '@/app/components/ui/AuthForms/OauthSignIn'
//import ForgotPassword from '@/app/components/ui/AuthForms/ForgotPassword'
//import UpdatePassword from '@/app/components/ui/AuthForms/UpdatePassword'
//import SignUp from '@/app/components/ui/AuthForms/Signup'

//export default async function SignIn({
//  params,
//  searchParams
//}: {
//  params: { id: string }
//  searchParams: { disable_button: boolean }
//}) {
//  const { allowOauth, allowEmail, allowPassword } = getAuthTypes()
//  const viewTypes = getViewTypes()
//  const redirectMethod = getRedirectMethod()

//  // Declare 'viewProp' and initialize with the default value
//  let viewProp: string

//  // Assign url id to 'viewProp' if it's a valid string and ViewTypes includes it
//  if (typeof params.id === 'string' && viewTypes.includes(params.id)) {
//    viewProp = params.id
//  } else {
//    const preferredSignInView =
//      cookies().get('preferredSignInView')?.value || null
//    viewProp = getDefaultSignInView(preferredSignInView)
//    return redirect(`/signin/${viewProp}`)
//  }

//  // Check if the user is already logged in and redirect to the account page if so
//  const supabase = createClient()

//  const {
//    data: { user }
//  } = await supabase.auth.getUser()

//  if (user && viewProp !== 'update_password') {
//    return redirect('/')
//  } else if (!user && viewProp === 'update_password') {
//    return redirect('/signin')
//  }

//  return (
//    <div className="flex justify-center height-screen-helper">
//      <div className="flex flex-col justify-between max-w-lg p-3 m-auto w-80 ">
//        <div className="flex justify-center pb-12 ">
//          <Logo width="64px" height="64px" />
//        </div>
//        <Card
//          title={
//            viewProp === 'forgot_password'
//              ? 'Reset Password'
//              : viewProp === 'update_password'
//                ? 'Update Password'
//                : viewProp === 'signup'
//                  ? 'Sign Up'
//                  : 'Sign In'
//          }
//        >
//          {viewProp === 'password_signin' && (
//            <PasswordSignIn
//              allowEmail={allowEmail}
//              redirectMethod={redirectMethod}
//            />
//          )}
//          {viewProp === 'email_signin' && (
//            <EmailSignIn
//              allowPassword={allowPassword}
//              redirectMethod={redirectMethod}
//              disableButton={searchParams.disable_button}
//            />
//          )}
//          {viewProp === 'forgot_password' && (
//            <ForgotPassword
//              allowEmail={allowEmail}
//              redirectMethod={redirectMethod}
//              disableButton={searchParams.disable_button}
//            />
//          )}
//          {viewProp === 'update_password' && (
//            <UpdatePassword redirectMethod={redirectMethod} />
//          )}
//          {viewProp === 'signup' && (
//            <SignUp allowEmail={allowEmail} redirectMethod={redirectMethod} />
//          )}
//          {viewProp !== 'update_password' &&
//            viewProp !== 'signup' &&
//            allowOauth && (
//              <>
//                <Separator text="Third-party sign-in" />
//                <OauthSignIn />
//              </>
//            )}
//        </Card>
//      </div>
//    </div>
//  )
//}
