// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined
    }
    serve(handler: (req: Request) => Promise<Response>): void
  }
}

export const handler = async (req: Request) => {
  try {
    // Get the stripe signature from the headers
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response('No signature', { status: 400 })
    }

    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET')
    const STRIPE_WEBHOOK_SIGNING_SECRET = Deno.env.get(
      'STRIPE_WEBHOOK_SIGNING_SECRET'
    )
    if (!STRIPE_SECRET || !STRIPE_WEBHOOK_SIGNING_SECRET) {
      return new Response('Missing environment variables', { status: 500 })
    }

    // Initialize Stripe
    const stripe = new Stripe(STRIPE_SECRET, {
      apiVersion: '2023-10-16'
    })

    // Get the raw body
    const body = await req.text()

    // Verify the webhook signature
    let event
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        STRIPE_WEBHOOK_SIGNING_SECRET
      )
    } catch (err: any) {
      return new Response(
        `Webhook signature verification failed: ${err?.message || 'Unknown error'}`,
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Call the database function with the event data
    const { data, error } = await supabaseClient.rpc('handle_stripe_webhook', {
      stripe_event: JSON.stringify(event)
    })

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({ success: true }), {
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

//import "jsr:@supabase/functions-js/edge-runtime.d.ts"

//console.log("Hello from Functions!")

//Deno.serve(async (req) => {
//  const { name } = await req.json()
//  const data = {
//    message: `Hello ${name}!`,
//  }

//  return new Response(
//    JSON.stringify(data),
//    { headers: { "Content-Type": "application/json" } },
//  )
//})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/stripe-staging-webhook' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
