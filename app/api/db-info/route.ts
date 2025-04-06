import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createClient()

    // Try to query each table individually to avoid TypeScript errors
    const results: Record<string, any> = {}

    // Check users table
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .limit(1)

      results.users = {
        exists: !usersError,
        columnNames: usersData && usersData.length > 0 ? Object.keys(usersData[0]) : [],
        sample: usersData && usersData.length > 0 ? usersData[0] : null,
        error: usersError?.message
      }
    } catch (err) {
      results.users = { exists: false, error: 'Failed to query users table' }
    }

    // Check customers table
    try {
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .limit(1)

      results.customers = {
        exists: !customersError,
        columnNames: customersData && customersData.length > 0 ? Object.keys(customersData[0]) : [],
        sample: customersData && customersData.length > 0 ? customersData[0] : null,
        error: customersError?.message
      }
    } catch (err) {
      results.customers = { exists: false, error: 'Failed to query customers table' }
    }

    // Check subscriptions table
    try {
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('subscriptions')
        .select('*')
        .limit(1)

      results.subscriptions = {
        exists: !subscriptionsError,
        columnNames: subscriptionsData && subscriptionsData.length > 0 ? Object.keys(subscriptionsData[0]) : [],
        sample: subscriptionsData && subscriptionsData.length > 0 ? subscriptionsData[0] : null,
        error: subscriptionsError?.message
      }
    } catch (err) {
      results.subscriptions = { exists: false, error: 'Failed to query subscriptions table' }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in db-info API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch database info' },
      { status: 500 }
    )
  }
}