// utils/supabase/queries.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';

export const getUser = cache(async (supabase: SupabaseClient) => {
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    // If there's an auth error indicating no session/user
    if (error?.status === 401) {
      return { user: null, error: null };
    }

    // If there's any other type of error
    if (error) {
      return {
        user: null,
        error: {
          message: error.message,
          status: error.status,
          name: error.name
        }
      };
    }

    // Successful case with user
    return { user, error: null };
  } catch (error) {
    // Unexpected errors (network issues, etc)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error getting user:', error);
    return {
      user: null,
      error: {
        message: errorMessage,
        name: error instanceof Error ? error.name : 'UnknownError',
        status: 500
      }
    };
  }
});

export const getUserDetails = cache(async (supabase: SupabaseClient) => {
  try {
    const { data, error } = await supabase.from('users').select('*').single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting user details:', error);
    return null;
  }
});

export const getSubscription = cache(async (supabase: SupabaseClient) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, prices(*, products(*))')
      .in('status', ['trialing', 'active'])
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting subscription:', error);
    return null;
  }
});

export const getProducts = cache(async (supabase: SupabaseClient) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, prices(*)')
      .eq('active', true)
      .eq('prices.active', true)
      .order('metadata->index')
      .order('unit_amount', { referencedTable: 'prices' });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting products:', error);
    return null;
  }
});
