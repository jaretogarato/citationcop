import { PDFDocument } from 'pdf-lib';

export async function stripImagesAndCompress(file: File): Promise<Blob> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    // Just apply compression without page manipulation
    const compressedPdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
        updateFieldAppearances: false
    });
    
    return new Blob([compressedPdfBytes], { type: 'application/pdf' });
}