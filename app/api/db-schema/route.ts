//import { NextRequest, NextResponse } from 'next/server'
//import { createClient } from '@/app/utils/supabase/server'

//export async function GET(request: NextRequest) {
//  try {
//    // Initialize Supabase client
//    const supabase = createClient()

//    // Get a list of tables
//    const { data: tables, error: tablesError } = await supabase
//      .from('pg_catalog.pg_tables')
//      .select('schemaname, tablename')
//      .eq('schemaname', 'public')

//    if (tablesError) {
//      console.error('Error fetching tables:', tablesError)
//      return NextResponse.json(
//        { error: 'Failed to fetch tables' },
//        { status: 500 }
//      )
//    }

//    // Get column information for the users table
//    const { data: userColumns, error: userColumnsError } = await supabase
//      .from('information_schema.columns')
//      .select('column_name, data_type')
//      .eq('table_name', 'users')
//      .eq('table_schema', 'public')

//    if (userColumnsError) {
//      console.error('Error fetching user columns:', userColumnsError)
//    }

//    // Check if there's a profiles table
//    let profileColumns = null
//    try {
//      const { data: columns, error: columnsError } = await supabase
//        .from('information_schema.columns')
//        .select('column_name, data_type')
//        .eq('table_name', 'profiles')
//        .eq('table_schema', 'public')

//      if (!columnsError) {
//        profileColumns = columns
//      }
//    } catch (err) {
//      console.log('No profiles table found')
//    }

//    // Check if there's a customers table
//    let customerColumns = null
//    try {
//      const { data: columns, error: columnsError } = await supabase
//        .from('information_schema.columns')
//        .select('column_name, data_type')
//        .eq('table_name', 'customers')
//        .eq('table_schema', 'public')

//      if (!columnsError) {
//        customerColumns = columns
//      }
//    } catch (err) {
//      console.log('No customers table found')
//    }

//    // Return the schema information
//    return NextResponse.json({
//      tables: tables,
//      users_columns: userColumns,
//      profiles_columns: profileColumns,
//      customers_columns: customerColumns
//    })
//  } catch (error) {
//    console.error('Error in db-schema API:', error)
//    return NextResponse.json(
//      { error: 'Failed to fetch database schema' },
//      { status: 500 }
//    )
//  }
//}