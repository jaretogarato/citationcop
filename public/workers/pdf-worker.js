"use strict";
(() => {
  // app/services/grobid-reference-service.ts
  var GrobidReferenceService = class {
    constructor(grobidEndpoint) {
      this.grobidEndpoint = grobidEndpoint;
    }
    async extractReferences(file) {
      try {
        const references = await this.extractWithGrobid(file);
        return references;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Reference extraction failed: ${errorMessage}`);
      }
    }
    async extractWithGrobid(file) {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(this.grobidEndpoint, {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        throw new Error(`GROBID extraction failed: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      return data.references || [];
    }
  };

  // app/services/pdf-parse-and-extract-references.ts
  var PDFParseAndExtractReferenceService = class {
    openAIEndpoint;
    parsePDFEndpoint;
    constructor(openAIEndpoint, parsePDFEndpoint) {
      this.openAIEndpoint = openAIEndpoint;
      this.parsePDFEndpoint = parsePDFEndpoint;
    }
    /**
     * Parses the PDF and extracts references.
     * @param file The PDF file to process.
     * @returns The extracted references.
     */
    async parseAndExtractReferences(file) {
      console.log("*** Parsing PDF using the parse-pdf endpoint ***");
      const formData = new FormData();
      formData.append("file", file);
      const parseResponse = await fetch(this.parsePDFEndpoint, {
        method: "POST",
        body: formData
      });
      if (!parseResponse.ok) {
        throw new Error(`Parsing API failed: ${parseResponse.statusText}`);
      }
      const { text: extractedText } = await parseResponse.json();
      console.log("Extracted text from parse-pdf endpoint:", extractedText);
      console.log("\u{1F4E4} Sending to OpenAI...");
      const response = await fetch(this.openAIEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: extractedText })
      });
      if (!response.ok) {
        throw new Error(`OpenAI API failed: ${response.statusText}`);
      }
      const { references } = await response.json();
      console.log("\u{1F4E5} Received references from OpenAI:", references);
      console.log("*** Detailed References ***");
      references.forEach((ref, index) => {
        console.log(`Reference #${index + 1}`);
        console.log(`  Authors: ${ref.authors.join(", ")}`);
        console.log(`  Title: ${ref.title}`);
        console.log(`  Year: ${ref.year}`);
        console.log(`  Journal: ${ref.journal}`);
        console.log(`  DOI: ${ref.DOI}`);
        console.log(`  Publisher: ${ref.publisher}`);
        console.log(`  Volume: ${ref.volume}`);
        console.log(`  Issue: ${ref.issue}`);
        console.log(`  Pages: ${ref.pages}`);
        console.log(`  URL: ${ref.url}`);
        console.log(`  Raw: ${ref.raw}`);
      });
      return references;
    }
  };

  // app/services/workers/pdf.worker.ts
  var referenceService = new GrobidReferenceService("/api/grobid/references");
  var pdfReferenceService = new PDFParseAndExtractReferenceService(
    "/api/references/extract",
    "/api/parse-pdf"
  );
  self.onmessage = async (e) => {
    const { type, pdfId, file } = e.data;
    if (type === "process") {
      console.log(`\u{1F680} Worker starting to process PDF ${pdfId}`);
      try {
        console.log("\u{1F4E4} Sending to GROBID...");
        const references = await referenceService.extractReferences(file);
        let finalReferences = references;
        if (references.length === 0) {
          console.log(
            "No references found via GROBID, falling back to PDF parsing..."
          );
          finalReferences = await pdfReferenceService.parseAndExtractReferences(file);
          console.log("\u{1F4E5} Received references from OpenAI:", finalReferences);
        }
        self.postMessage({
          type: "complete",
          pdfId,
          references: finalReferences
        });
        console.log(`\u2705 Successfully processed PDF ${pdfId}`);
      } catch (error) {
        console.error("\u274C Error processing PDF:", error);
        self.postMessage({
          type: "error",
          pdfId,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  };
})();
