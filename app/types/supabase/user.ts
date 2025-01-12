// types/user.ts
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Database } from '@/types_db'

// Base types from database schema
export type UserDetails = Database['public']['Tables']['users']['Row']


// Response types
export interface GetUserResponse {
  user: SupabaseUser | null
  error: {
    message: string
    status?: number
    name: string
  } | null
}

export interface UserDetailsResponse {
  data: UserDetails | null
  error: {
    message: string
    code: string
    details: string | null
    hint: string | null
  } | null
}
