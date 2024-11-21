// utils/supabase/queries.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';

export const getUser = cache(async (supabase: SupabaseClient) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
});

export const getUserDetails = cache(async (supabase: SupabaseClient) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .single();
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