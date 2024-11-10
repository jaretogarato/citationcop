'use server'

import PDFParser from "pdf2json";


export async function parsePDF(binaryData: number[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      const extractedText = pdfData.Pages?.map((page: any) =>
        page.Texts.map((textObj: any) => decodeURIComponent(textObj.R[0].T)).join(" ")
      ).join("\n\n");

      resolve(extractedText);
    });

    pdfParser.on("pdfParser_dataError", (errData) => {
      console.error("PDF parsing error:", errData);
      reject("Failed to parse PDF");
    });

    // Convert the binary data back to a Buffer and parse it
    const buffer = Buffer.from(binaryData);
    pdfParser.parseBuffer(buffer);
  });
}

