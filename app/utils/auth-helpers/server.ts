'use server';

import { createClient } from '@/app/utils/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getURL, getErrorRedirect, getStatusRedirect } from '@/app/utils/helpers';
import { getAuthTypes } from '@/app/utils/auth-helpers/settings';

import type { Database } from '@/types_db';
import Stripe from 'stripe';
import { stripe } from '@/app/utils/stripe/config';

function isValidEmail(email: string) {
  var regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return regex.test(email);
}

export async function redirectToPath(path: string) {
  return redirect(path);
}

export async function SignOut(formData: FormData) {
  const pathName = String(formData.get('pathName')).trim();

  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return getErrorRedirect(
      pathName,
      'Hmm... Something went wrong.',
      'You could not be signed out.'
    );
  }

  return '/signin';
}

export async function signInWithEmail(formData: FormData) {
  const cookieStore = cookies();
  const callbackURL = getURL('/auth/callback');

  const email = String(formData.get('email')).trim();
  let redirectPath: string;

  if (!isValidEmail(email)) {
    redirectPath = getErrorRedirect(
      '/signin/email_signin',
      'Invalid email address.',
      'Please try again.'
    );
  }

  const supabase = createClient();
  let options = {
    emailRedirectTo: callbackURL,
    shouldCreateUser: true
  };

  // If allowPassword is false, do not create a new user
  const { allowPassword } = getAuthTypes();
  if (allowPassword) options.shouldCreateUser = false;
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: options
  });

  if (error) {
    redirectPath = getErrorRedirect(
      '/signin/email_signin',
      'You could not be signed in.',
      error.message
    );
  } else if (data) {
    cookieStore.set('preferredSignInView', 'email_signin', { path: '/' });
    redirectPath = getStatusRedirect(
      '/signin/email_signin',
      'Success!',
      'Please check your email for a magic link. You may now close this tab.',
      true
    );
  } else {
    redirectPath = getErrorRedirect(
      '/signin/email_signin',
      'Hmm... Something went wrong.',
      'You could not be signed in.'
    );
  }

  return redirectPath;
}

export async function requestPasswordUpdate(formData: FormData) {
  const callbackURL = getURL('/auth/reset_password');

  // Get form data
  const email = String(formData.get('email')).trim();
  let redirectPath: string;

  if (!isValidEmail(email)) {
    redirectPath = getErrorRedirect(
      '/signin/forgot_password',
      'Invalid email address.',
      'Please try again.'
    );
  }

  const supabase = createClient();

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackURL
  });

  if (error) {
    redirectPath = getErrorRedirect(
      '/signin/forgot_password',
      error.message,
      'Please try again.'
    );
  } else if (data) {
    redirectPath = getStatusRedirect(
      '/signin/forgot_password',
      'Success!',
      'Please check your email for a password reset link. You may now close this tab.',
      true
    );
  } else {
    redirectPath = getErrorRedirect(
      '/signin/forgot_password',
      'Hmm... Something went wrong.',
      'Password reset email could not be sent.'
    );
  }

  return redirectPath;
}

export async function signInWithPassword(formData: FormData) {
  const cookieStore = cookies();
  const email = String(formData.get('email')).trim();
  const password = String(formData.get('password')).trim();
  let redirectPath: string;

  const supabase = createClient();
  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirectPath = getErrorRedirect(
      '/signin/password_signin',
      'Sign in failed.',
      error.message
    );
  } else if (data.user) {
    cookieStore.set('preferredSignInView', 'password_signin', { path: '/' });
    redirectPath = getStatusRedirect('/', 'Success!', 'You are now signed in.');
  } else {
    redirectPath = getErrorRedirect(
      '/signin/password_signin',
      'Hmm... Something went wrong.',
      'You could not be signed in.'
    );
  }

  return redirectPath;
}

//export async function signUp(formData: FormData) {
//  const callbackURL = getURL('/auth/callback');

//  const email = String(formData.get('email')).trim();
//  const password = String(formData.get('password')).trim();
//  let redirectPath: string;

//  if (!isValidEmail(email)) {
//    redirectPath = getErrorRedirect(
//      '/signin/signup',
//      'Invalid email address.',
//      'Please try again.'
//    );
//  }

//  const supabase = createClient();
//  const { error, data } = await supabase.auth.signUp({
//    email,
//    password,
//    options: {
//      emailRedirectTo: callbackURL
//    }
//  });

//  if (error) {
//    redirectPath = getErrorRedirect(
//      '/signin/signup',
//      'Sign up failed.',
//      error.message
//    );
//  } else if (data.session) {
//    redirectPath = getStatusRedirect('/', 'Success!', 'You are now signed in.');
//  } else if (
//    data.user &&
//    data.user.identities &&
//    data.user.identities.length == 0
//  ) {
//    redirectPath = getErrorRedirect(
//      '/signin/signup',
//      'Sign up failed.',
//      'There is already an account associated with this email address. Try resetting your password.'
//    );
//  } else if (data.user) {
//    redirectPath = getStatusRedirect(
//      '/',
//      'Success!',
//      'Please check your email for a confirmation link. You may now close this tab.'
//    );
//  } else {
//    redirectPath = getErrorRedirect(
//      '/signin/signup',
//      'Hmm... Something went wrong.',
//      'You could not be signed up.'
//    );
//  }

//  return redirectPath;
//}

export async function signUp(formData: FormData) {
  const callbackURL = getURL('/auth/callback');
  const email = String(formData.get('email')).trim();
  const password = String(formData.get('password')).trim();
  const stripeSessionId = formData.get('stripeSessionId')?.toString();
  let redirectPath: string;

  if (!isValidEmail(email)) {
    redirectPath = getErrorRedirect(
      '/signin/signup',
      'Invalid email address.',
      'Please try again.'
    );
    return redirectPath;
  }

  const supabase = createClient();

  try {
    // Sign up the user
    const { error: signUpError, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackURL
      }
    });

    if (signUpError) throw signUpError;

    // If we have a Stripe session, handle the subscription
    if (stripeSessionId && data.user) {
      try {
        const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

        if (session.subscription) {
          // Get subscription details from Stripe
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

          const subscriptionData: Database['public']['Tables']['subscriptions']['Insert'] = {
            id: subscription.id,
            user_id: data.user.id,
            status: subscription.status as Database['public']['Enums']['subscription_status'],
            price_id: subscription.items.data[0].price.id,
            quantity: subscription.items.data[0].quantity,
            cancel_at_period_end: subscription.cancel_at_period_end,
            created: new Date(subscription.created * 1000).toISOString(),
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            ended_at: subscription.ended_at
              ? new Date(subscription.ended_at * 1000).toISOString()
              : null,
            cancel_at: subscription.cancel_at
              ? new Date(subscription.cancel_at * 1000).toISOString()
              : null,
            canceled_at: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000).toISOString()
              : null,
            trial_start: subscription.trial_start
              ? new Date(subscription.trial_start * 1000).toISOString()
              : null,
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            metadata: subscription.metadata
          };

          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .insert(subscriptionData);

          if (subscriptionError) throw subscriptionError;
        }
      } catch (stripeError) {
        console.error('Stripe subscription linking error:', stripeError);
        // Continue with sign up even if subscription linking fails
        // You might want to log this for follow-up
      }
    }

    if (data.session) {
      redirectPath = getStatusRedirect('/', 'Success!', 'You are now signed in.');
    } else if (data.user && data.user.identities && data.user.identities.length == 0) {
      redirectPath = getErrorRedirect(
        '/signin/signup',
        'Sign up failed.',
        'There is already an account associated with this email address. Try resetting your password.'
      );
    } else if (data.user) {
      redirectPath = getStatusRedirect(
        '/',
        'Success!',
        'Please check your email for a confirmation link. You may now close this tab.'
      );
    } else {
      redirectPath = getErrorRedirect(
        '/signin/signup',
        'Hmm... Something went wrong.',
        'You could not be signed up.'
      );
    }
  } catch (error) {
    console.error('Signup error:', error);
    redirectPath = getErrorRedirect(
      '/signin/signup',
      'Sign up failed.',
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }

  return redirectPath;
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password')).trim();
  const passwordConfirm = String(formData.get('passwordConfirm')).trim();
  let redirectPath: string;

  // Check that the password and confirmation match
  if (password !== passwordConfirm) {
    redirectPath = getErrorRedirect(
      '/signin/update_password',
      'Your password could not be updated.',
      'Passwords do not match.'
    );
  }

  const supabase = createClient();
  const { error, data } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    redirectPath = getErrorRedirect(
      '/signin/update_password',
      'Your password could not be updated.',
      error.message
    );
  } else if (data.user) {
    redirectPath = getStatusRedirect(
      '/',
      'Success!',
      'Your password has been updated.'
    );
  } else {
    redirectPath = getErrorRedirect(
      '/signin/update_password',
      'Hmm... Something went wrong.',
      'Your password could not be updated.'
    );
  }

  return redirectPath;
}

export async function updateEmail(formData: FormData) {
  // Get form data
  const newEmail = String(formData.get('newEmail')).trim();

  // Check that the email is valid
  if (!isValidEmail(newEmail)) {
    return getErrorRedirect(
      '/account',
      'Your email could not be updated.',
      'Invalid email address.'
    );
  }

  const supabase = createClient();

  const callbackUrl = getURL(
    getStatusRedirect('/account', 'Success!', `Your email has been updated.`)
  );

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    {
      emailRedirectTo: callbackUrl
    }
  );

  if (error) {
    return getErrorRedirect(
      '/account',
      'Your email could not be updated.',
      error.message
    );
  } else {
    return getStatusRedirect(
      '/account',
      'Confirmation emails sent.',
      `You will need to confirm the update by clicking the links sent to both the old and new email addresses.`
    );
  }
}

export async function updateName(formData: FormData) {
  // Get form data
  const fullName = String(formData.get('fullName')).trim();

  // Create Supabase client
  const supabase = createClient();

  // Update auth.user_metadata and public.users
  try {
    // Update name in auth.user_metadata
    const { error: authError, data } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });

    if (authError) {
      return getErrorRedirect(
        '/account',
        'Your name could not be updated in authentication metadata.',
        authError.message
      );
    }

    // Get the user ID from the updated user data
    const userId = data?.user?.id;
    if (!userId) {
      return getErrorRedirect(
        '/account',
        'User ID could not be found.',
        'The update operation failed.'
      );
    }

    // Update name in the public.users table
    const { error: usersError } = await supabase
      .from('users')
      .update({ full_name: fullName })
      .eq('id', userId);

    if (usersError) {
      return getErrorRedirect(
        '/account',
        'Your name could not be updated in the users table.',
        usersError.message
      );
    }

    // If both updates are successful, return success redirect
    return getStatusRedirect(
      '/account',
      'Success!',
      'Your name has been updated in both locations.'
    );
  } catch (error) {
    console.error('Unexpected error updating name:', error);
    return getErrorRedirect(
      '/account',
      'Unexpected error occurred.',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

//export async function updateName(formData: FormData) {
//  // Get form data
//  const fullName = String(formData.get('fullName')).trim();

//  const supabase = createClient();
//  const { error, data } = await supabase.auth.updateUser({
//    data: { full_name: fullName }
//  });
//	//jgg

//  if (error) {
//    return getErrorRedirect(
//      '/account',
//      'Your name could not be updated.',
//      error.message
//    );
//  } else if (data.user) {
//    return getStatusRedirect(
//      '/account',
//      'Success!',
//      'Your name has been updated.'
//    );
//  } else {
//    return getErrorRedirect(
//      '/account',
//      'Hmm... Something went wrong.',
//      'Your name could not be updated.'
//    );
//  }
//}
