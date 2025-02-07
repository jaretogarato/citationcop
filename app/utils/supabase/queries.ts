// utils/supabase/queries.ts
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { 
  ProductWithPrices,
  SubscriptionWithPriceAndProduct
} from '@/app/types/supabase/subscription'

import type { GetUserResponse,
  UserDetailsResponse,
  UserDetails } from '@/app/types/supabase/user'

// Type for database query error responses
interface DatabaseError {
  message: string
  code: string
  details: string | null
  hint: string
}

export const getUser = cache(
  async (supabase: SupabaseClient): Promise<GetUserResponse> => {
    try {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser()

      if (error?.status === 401) {
        return { user: null, error: null }
      }

      if (error) {
        return {
          user: null,
          error: {
            message: error.message,
            status: error.status,
            name: error.name
          }
        }
      }

      return { user, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Error getting user:', error)
      
      return {
        user: null,
        error: {
          message: errorMessage,
          name: error instanceof Error ? error.name : 'UnknownError',
          status: 500
        }
      }
    }
  }
)

export const getUserDetails = cache(
  async (supabase: SupabaseClient): Promise<UserDetailsResponse> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .single()

      if (error?.code === 'PGRST116') {
        return { data: null, error: null }
      }

      if (error) {
        const dbError: DatabaseError = {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        }
        return { data: null, error: dbError }
      }

      return {
        data: data as UserDetails,
        error: null
      }
    } catch (error) {
      console.error('Error getting user details:', error)
      
      const dbError: DatabaseError = {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'UNEXPECTED_ERROR',
        details: null,
        hint: 'This might be a network or server issue'
      }
      
      return { data: null, error: dbError }
    }
  }
)

export const getSubscriptionWithPriceAndProduct = cache(
  async (supabase: SupabaseClient): Promise<SubscriptionWithPriceAndProduct | null> => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, prices(*, products(*))')
        .in('status', ['trialing', 'active'])
        .maybeSingle()

      if (error) throw error
      return data as SubscriptionWithPriceAndProduct
    } catch (error) {
      console.error('Error getting subscription:', error)
      return null
    }
  }
)

export const getProductsAndPrices = cache(
  async (supabase: SupabaseClient): Promise<ProductWithPrices[] | null> => {
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
        .eq('prices.active', true)

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      return data as ProductWithPrices[]
    } catch (error) {
      console.error('Error getting products:', error)
      return null
    }
  }
)