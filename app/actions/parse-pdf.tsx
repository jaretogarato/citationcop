// /actions/parse-pdf.tsx
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
            
            //console.log("Cleaned text from PDF:", extractedText)
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
    // First pass: basic cleaning
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
        .filter(line => line.length > 30 && line.length < 500) // Minimum length for citations

    // Remove common paper sections and headers
    lines = lines.filter(line => !isBoilerplateText(line))

    // Keep lines that look like references
    lines = lines.filter(line => {
        // Enhanced patterns for references
        const hasYear = /\b(19|20)\d{2}\b/.test(line)
        const hasAuthors = /([A-Z][a-z]+[\s,]+){1,}/.test(line) || // Multiple capitalized words
                         /[A-Z][a-z]+\s+and\s+[A-Z][a-z]+/.test(line) || // Author "and" Author
                         /[A-Z][a-z]+,\s*[A-Z]\./.test(line) // Last, F.
        const hasDOI = /doi\.org|DOI:/i.test(line)
        const hasURL = /http|www\./i.test(line)
        const hasVolume = /Vol\.|Volume|\b\d+\(\d+\)/.test(line)
        const hasPages = /pp\.|pages|[\d]+[-–]\d+/.test(line)
        const hasPublisher = /Press|Publishers|Publishing|University/i.test(line)
        const hasJournal = /Journal|Proceedings|Conference|Trans\.|Symposium/i.test(line)
        const hasCitation = /^\[\d+\]/.test(line) || /\(\d{4}\)/.test(line)
        
        const referenceIndicators = [
            hasYear,
            hasAuthors,
            hasDOI,
            hasURL,
            hasVolume,
            hasPages,
            hasPublisher,
            hasJournal,
            hasCitation
        ].filter(Boolean).length

        // More strict requirements: must have more indicators or specific combinations
        return (referenceIndicators >= 3) || // Must match at least 3 patterns
               (hasAuthors && hasYear && (hasJournal || hasPublisher)) // Or must have crucial citation elements
    })

    // If we filtered too aggressively, try a more lenient approach
    if (lines.length < 5) {
        lines = text.split('\n')
            .filter(line => line.trim().length > 30)
            .filter(line => {
                const hasYear = /\b(19|20)\d{2}\b/.test(line)
                const hasAuthors = /([A-Z][a-z]+[\s,]+){1,}/.test(line)
                return hasYear && hasAuthors
            })
    }

    return lines.join('\n')
}

function isBoilerplateText(line: string): boolean {
    const boilerplatePatterns = [
        /^Abstract/i,
        /^Introduction/i,
        /^Methodology/i,
        /^Results/i,
        /^Discussion/i,
        /^Conclusion/i,
        /^References$/i,
        /^Bibliography$/i,
        /^Table of Contents/i,
        /^Chapter \d+/i,
        /^Figure \d+/i,
        /^Appendix/i,
        /^\d+\s+[A-Z][A-Z\s]+$/,  // Page headers
        /^Page \d+$/i,
        /^\d+$/  // Page numbers
    ]

    return boilerplatePatterns.some(pattern => pattern.test(line.trim()))
}