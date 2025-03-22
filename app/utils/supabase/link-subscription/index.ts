// app/utils/supabase/link-subscription/index.ts
import { createClient } from '@supabase/supabase-js'

// Don't redeclare Deno - it seems your environment already has it defined
// Just use the existing declaration

interface RequestPayload {
  user_id: string;
  stripe_customer_id: string;
  subscription_id: string;
}

export const handler = async (req: Request) => {
  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const { user_id, stripe_customer_id, subscription_id } = await req.json() as RequestPayload;

    // Update user metadata in auth.users table directly
    const { data, error } = await supabaseClient.auth.admin.updateUserById(
      user_id,
      {
        user_metadata: {
          stripe_customer_id,
          subscription_id,
          subscription_status: 'active'
        }
      }
    );

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    })
  }
}

Deno.serve(handler)