import { NextRequest, NextResponse } from 'next/server';

const PDF_CONVERTER_URL = process.env.NEXT_PUBLIC_PDF_CONVERTER_URL

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();

    const file = formData.get('pdf') as File | null;
    const range = formData.get('range') as string | null;

    console.log('PDF_CONVERTER_URL:', PDF_CONVERTER_URL);
    console.log('File received:', file?.name, 'Size:', file?.size);
    console.log('Range:', range);

    if (!file || !range) {
      return NextResponse.json(
        { error: 'PDF file and range are required.' },
        { status: 400 }
      );
    }

    const serverFormData = new FormData();
    serverFormData.append('pdf', file, file.name || 'file.pdf');
    serverFormData.append('range', range);

    const url = `${PDF_CONVERTER_URL}/api/pdf2images`;
    console.log('Sending PDF to:', url);

    const response = await fetch(url, {
      method: 'POST',
      body: serverFormData,
    });

    console.log('PDF server response status:', response.status);
    const responseText = await response.text();
    console.log('PDF server response:', responseText);

    if (!response.ok) {
      throw new Error(`Server Error: ${response.statusText}\nResponse: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/pdf2images:', error);
    return NextResponse.json(
      { error: 'Failed to process the PDF. Please try again later.' },
      { status: 500 }
    );
  }
}