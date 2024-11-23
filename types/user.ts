// app/types/user.ts

export type UserDetails = {
    full_name: string;
    // Add other user properties here as needed, for example:
    email?: string;
    created_at?: string;
  };
  
  export type UserDetailsResponse = {
    data: UserDetails | null;
    error: {
      message: string;
      code: string;
      details: string | null;
      hint: string;
    } | null;
  };
  