// app/api/stripe/checkout-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/app/utils/stripe/config';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const session_id = searchParams.get('session_id');

  if (!session_id) {
    return NextResponse.json(
      { error: 'Missing session_id parameter' },
      { status: 400 }
    );
  }

  try {
    // Retrieve the checkout session with expanded objects
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['customer', 'subscription', 'line_items']
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve checkout session' },
      { status: 500 }
    );
  }
}