import { NextRequest, NextResponse } from 'next/server'

const PDF_CONVERTER_URL = process.env.PDF_CONVERTER_URL; // Correct env variable

console.log('PDF_CONVERTER_URL: ', PDF_CONVERTER_URL);

// CORS Headers
const corsHeaders = new Headers({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

// Handle Preflight (OPTIONS) Requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();

    const file = formData.get('pdf') as File | null;
    const range = formData.get('range') as string | null;

    if (!file || !range) {
      return new NextResponse(
        JSON.stringify({ error: 'PDF file and range are required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const serverFormData = new FormData();
    serverFormData.append('pdf', file, file.name || 'file.pdf');
    serverFormData.append('range', range);

    const response = await fetch(PDF_CONVERTER_URL!, {
      method: 'POST',
      body: serverFormData,
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("📄 PDF Conversion API Response:", data); // 🐛 Debugging line

    return new NextResponse(JSON.stringify(data), { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Error in /api/pdf2images:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to process the PDF. Please try again later.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
