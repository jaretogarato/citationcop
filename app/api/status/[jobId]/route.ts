import { NextRequest, NextResponse } from 'next/server'

// Add OPTIONS method to handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const jobId = params.jobId
  console.log('Next.js status route hit for jobId:', jobId)
  console.log('Request URL:', request.url)

  const pdfServerUrl = process.env.NEXT_PUBLIC_PDF_CONVERTER_URL
  const statusUrl = `${pdfServerUrl}/api/status/${jobId}`
  console.log('Attempting to fetch from:', statusUrl)

  try {
    const response = await fetch(statusUrl)
    console.log('PDF server status response:', response.status)

    if (!response.ok) {
      console.error('PDF server status error:', response.status, response.statusText)
      return NextResponse.json(
        { error: `Failed to fetch status from PDF server: ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('PDF server returned data:', data)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching status:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

//import { NextRequest, NextResponse } from 'next/server'

//export async function GET(
//  request: NextRequest,
//  { params }: { params: { jobId: string } }
//) {
//  const jobId = params.jobId
//  const pdfServerUrl = process.env.PDF_SERVER_URL || 'http://localhost:5000'

//  try {
//    console.log(`Fetching status from: ${pdfServerUrl}/api/status/${jobId}`)
//    const response = await fetch(`${pdfServerUrl}/api/status/${jobId}`)

//    if (!response.ok) {
//      console.error('PDF server status error:', response.status, response.statusText)
//      return NextResponse.json(
//        { error: 'Failed to fetch status from PDF server' },
//        { status: response.status }
//      )
//    }

//    const data = await response.json()
//    return NextResponse.json(data)
//  } catch (error) {
//    console.error('Error fetching status:', error)
//    return NextResponse.json(
//      { error: 'Internal server error', details: error.message },
//      { status: 500 }
//    )
//  }
//}