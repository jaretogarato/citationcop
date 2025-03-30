import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const supabase = createClient()

    // Check if user exists in public.users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (userError) {
      console.error('Error checking user existence:', userError)
      throw userError
    }

    // Also check customers table if needed
    // You can uncomment this if your customers table has an email field
    /*
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (customerError && customerError.code !== 'PGRST116') {
      console.error('Error checking customer existence:', customerError)
    }
    */

    // Return whether the user exists
    return NextResponse.json({
      exists: Boolean(userData) // || customerData
    })
  } catch (error) {
    console.error('Error in check-user-exists API:', error)
    return NextResponse.json(
      { error: 'Failed to check user existence' },
      { status: 500 }
    )
  }
}

//import { NextRequest, NextResponse } from 'next/server'
//import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
//import { cookies } from 'next/headers'

//export async function POST(request: NextRequest) {
//  try {
//    const { email } = await request.json()

//    if (!email) {
//      return NextResponse.json(
//        { error: 'Email is required' },
//        { status: 400 }
//      )
//    }

//    // Initialize Supabase client with server-side context
//    const cookieStore = cookies()
//    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

//    // Check if user exists in public.users table
//    const { data: userData, error: userError } = await supabase
//      .from('users')
//      .select('email')
//      .eq('email', email)
//      .maybeSingle()

//    if (userError) {
//      console.error('Error checking user existence:', userError)
//      throw userError
//    }

//    // Also check if email exists in customers table as a fallback
//    const { data: customerData, error: customerError } = await supabase
//      .from('customers')
//      .select('email')
//      .eq('email', email)
//      .maybeSingle()

//    if (customerError && customerError.code !== 'PGRST116') { // Ignore if column doesn't exist
//      console.error('Error checking customer existence:', customerError)
//    }

//    // Return whether the user exists
//    return NextResponse.json({
//      exists: Boolean(userData || customerData)
//    })
//  } catch (error) {
//    console.error('Error in check-user-exists API:', error)
//    return NextResponse.json(
//      { error: 'Failed to check user existence' },
//      { status: 500 }
//    )
//  }
//}