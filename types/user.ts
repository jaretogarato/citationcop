// /types/user.ts
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Type representing the response from `getUser`
export type GetUserResponse = {
  user: SupabaseUser | null;
  error: {
    message: string;
    status?: number; // This might be optional
    name: string;
  } | null;
};

// Type representing user details (more detailed information beyond authentication)
export type UserDetails = {
  full_name: string;
  // Add other properties if needed
};

// Type representing the response from `getUserDetails`
export type UserDetailsResponse = {
  data: UserDetails | null;
  error: {
    message: string;
    code: string;
    details: string | null;
    hint: string;
  } | null;
};
