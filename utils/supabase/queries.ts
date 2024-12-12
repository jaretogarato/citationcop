// utils/supabase/queries.ts
import type {
  SupabaseClient,
  User as SupabaseUser
} from '@supabase/supabase-js';
import { Tables } from '../../types_db';  // Adjust based on your file's location relative to root


type Product = Tables<'products'>;
type Price = Tables<'prices'>;
interface ProductWithPrices extends Product {
  prices: Price[];
}

import { cache } from 'react';
import {
  UserDetailsResponse,
  GetUserResponse,
  UserDetails
} from '@/types/user'; // Importing shared types

export const getUser = cache(
  async (supabase: SupabaseClient): Promise<GetUserResponse> => {
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
  }
);

export const getUserDetails = cache(
  async (supabase: SupabaseClient): Promise<UserDetailsResponse> => {
    try {
      const { data, error } = await supabase.from('users').select('*').single();

      // Handle "no rows returned" case (PGRST116)
      if (error?.code === 'PGRST116') {
        return {
          data: null,
          error: null
        };
      }

      // Handle other database errors
      if (error) {
        return {
          data: null,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          }
        };
      }

      // Successful case with user details
      return {
        data: data as UserDetails,
        error: null
      };
    } catch (error) {
      // Handle unexpected errors (network issues, etc)
      console.error('Error getting user details:', error);
      return {
        data: null,
        error: {
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'UNEXPECTED_ERROR',
          details: null,
          hint: 'This might be a network or server issue'
        }
      };
    }
  }
);

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
      .select(`
        *,
        prices (
          *
        )
      `)
      .eq('active', true)
      .eq('prices.active', true);  // Only get active prices

    //console.log('Raw database response:', data);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error getting products:', error);
    return null;
  }
});
