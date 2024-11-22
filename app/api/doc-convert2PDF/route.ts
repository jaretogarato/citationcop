// app/api/doc-convert2PDF/route.ts
import { NextResponse } from 'next/server';
import officeParser from 'officeparser';
import * as puppeteer from 'puppeteer';
import { IncomingForm, Fields, Files, File as FormidableFile } from 'formidable';
import { promises as fs } from 'fs';
import { Buffer } from 'buffer';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import type { IncomingMessage } from 'http';

export const config = {
  api: {
    bodyParser: false, // Disable Next.js default body parser to use formidable
  },
};

// Helper to convert Next.js Request to a readable Node stream that resembles IncomingMessage
function requestToIncomingMessage(request: Request): IncomingMessage {
  const readable = new Readable() as IncomingMessage & Readable;
  readable._read = () => {}; // No-op
  request.arrayBuffer().then((buffer) => {
    readable.push(Buffer.from(buffer));
    readable.push(null);
  });

  // Fill in necessary properties to make it compatible with IncomingMessage
  readable.headers = Object.fromEntries(request.headers.entries());
  readable.method = request.method || '';
  readable.url = request.url || '';

  return readable;
}

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const form = new IncomingForm();
    const stream = requestToIncomingMessage(request);

    const { fields, files }: { fields: Fields; files: Files } = await new Promise((resolve, reject) => {
      form.parse(stream, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const file = files.file && (Array.isArray(files.file) ? files.file[0] : (files.file as FormidableFile));

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (file.mimetype !== DOCX_TYPE) {
      console.log('Invalid content type:', file.mimetype);
      return NextResponse.json(
        { error: `Please upload a DOCX file. Received type: ${file.mimetype}` },
        { status: 400 }
      );
    }

    const tempDir: string = os.tmpdir();
    // Rename the file with a proper .docx extension for officeparser compatibility
    const inputFilePath: string = path.join(tempDir, `${file.newFilename}.docx`);
    await fs.rename(file.filepath, inputFilePath);

    // Parse DOCX to extract text using officeparser
    console.log('Parsing DOCX content with officeParser...');
    const config = {
      newlineDelimiter: '\n',
    };

    let parsedData: string;
    try {
      parsedData = await officeParser.parseOfficeAsync(inputFilePath, config);
    } catch (err) {
      console.error('Error parsing DOCX file:', err);
      throw new Error('Failed to parse DOCX file');
    }

    if (!parsedData) {
      throw new Error('No content found after parsing DOCX file');
    }

    let htmlContent: string = '<html><body>';
    htmlContent += parsedData
      .split('\n')
      .map((paragraph: string) => `<p>${paragraph}</p>`)
      .join('');
    htmlContent += '</body></html>';

    console.log('DOCX to HTML conversion successful');

    // Create PDF using Puppeteer
    console.log('Launching Puppeteer...');
    const browser: puppeteer.Browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page: puppeteer.Page = await browser.newPage();
    console.log('Setting page content...');
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              font-size: 11pt;
              line-height: 1.5;
              margin: 0 auto;
              padding: 20px;
              max-width: 800px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            td, th {
              padding: 8px;
              border: 1px solid #ddd;
            }
            p { margin: 0 0 10px 0; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const pdfUint8Array: Uint8Array = await page.pdf({
      format: 'A4',
      margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
      printBackground: true,
    });

    const pdfBuffer: Buffer = Buffer.from(pdfUint8Array);
    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error('PDF buffer creation failed');
    }
    await browser.close();
    console.log('PDF generated successfully, size:', pdfBuffer.length);

    // Clean up temporary DOCX file
    await fs.unlink(inputFilePath);
    console.log('Temporary DOCX file removed');

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${file.originalFilename?.replace(/\.[^/.]+$/, '')}.pdf`,
      },
    });
  } catch (error) {
    console.error('Processing failed:', error);
    return NextResponse.json(
      {
        error: `Processing failed: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}
