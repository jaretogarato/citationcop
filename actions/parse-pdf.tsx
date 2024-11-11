'use server'

import PDFParser from "pdf2json"

export async function parsePDF(binaryData: number[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser()

        pdfParser.on("pdfParser_dataReady", (pdfData) => {
            let extractedText = pdfData.Pages?.map((page: any) =>
                page.Texts.map((textObj: any) => decodeURIComponent(textObj.R[0].T)).join(" ")
            ).join("\n")

            extractedText = cleanText(extractedText)
            
            console.log("Cleaned text from PDF:", extractedText)
            resolve(extractedText)
        })

        pdfParser.on("pdfParser_dataError", (errData) => {
            console.error("PDF parsing error:", errData)
            reject("Failed to parse PDF")
        })

        const buffer = Buffer.from(binaryData)
        pdfParser.parseBuffer(buffer)
    })
}

function cleanText(text: string): string {
    let lines = text
        .split('\n')
        .map(line => {
            return line
                .replace(/\s+/g, ' ')
                .replace(/ﬁ/g, 'fi')
                .replace(/ﬂ/g, 'fl')
                .replace(/ﬀ/g, 'ff')
                .replace(/œ/g, 'oe')
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                .trim()
        })
        .filter(line => line.length > 1)

    // Keep lines that look like references
    lines = lines.filter(line => {
        // Common patterns in references
        const hasYear = /\b(19|20)\d{2}\b/.test(line)              // Has a year
        const hasAuthors = /[A-Z][a-z]+,\s*[A-Z]/.test(line)      // Has names with capitals
        const hasDOI = /doi\.org|DOI:/i.test(line)                // Has DOI
        const hasURL = /http|www\./i.test(line)                    // Has URL
        const hasVolume = /Vol\.|Volume/i.test(line)               // Has volume
        const hasPages = /pp\.|pages|[\d]+[-–]\d+/.test(line)      // Has page numbers
        const hasPublisher = /Press|Publishers|Publishing/i.test(line)
        const hasJournal = /Journal|Proceedings|Conference|Trans\./i.test(line)
        
        // Probably a reference if it has some of these patterns
        const likelyReference = [
            hasYear,
            hasAuthors,
            hasDOI,
            hasURL,
            hasVolume,
            hasPages,
            hasPublisher,
            hasJournal
        ].filter(Boolean).length >= 2  // Must match at least 2 patterns

        // Keep shorter lines that look like references
        return likelyReference && line.length < 500
    })

    // If we have too few lines, we might have filtered too aggressively
    if (lines.length < 5) {
        // Fallback to simpler filtering
        lines = text.split('\n')
            .filter(line => line.trim().length > 1)
            .filter(line => /\b(19|20)\d{2}\b/.test(line)) // At least keep lines with years
    }

    return lines.join('\n')
}