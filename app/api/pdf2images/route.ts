import { NextRequest, NextResponse } from 'next/server';

// Add a default URL or use non-null assertion
const PDF_CONVERTER_URL =
  process.env.NEXT_PUBLIC_PDF_CONVERTER_URL

//console.log('PDF_CONVERTER_URL: ', PDF_CONVERTER_URL)

export async function POST(req: NextRequest): Promise<NextResponse> {
   try {
     const formData = await req.formData();

     const file = formData.get('pdf') as File | null;
     const range = formData.get('range') as string | null;

    console.log("range : " , range)

     if (!file || !range) {
       return NextResponse.json(
         { error: 'PDF file and range are required.' },
         { status: 400 }
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
     return NextResponse.json(data);
   } catch (error) {
     console.error('Error in /api/pdf2images:', error);
     return NextResponse.json(
       { error: 'Failed to process the PDF. Please try again later.' },
       { status: 500 }
     );
   }
}