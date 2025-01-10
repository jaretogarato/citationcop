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

  // app/services/search-reference-service.ts
  var BATCH_SIZE = 5;
  var SearchReferenceService = class {
    async processReference(reference) {
      const query = `${reference.title} ${reference.authors.join(" ")}`;
      try {
        const response = await fetch("/api/serper", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            Pragma: "no-cache"
          },
          body: JSON.stringify({ q: query })
        });
        if (!response.ok) {
          console.error("Search API error:", await response.text());
          throw new Error("Failed to process reference");
        }
        const results = await response.json();
        console.log("Search API results for reference:", reference.id, results);
        return {
          ...reference,
          status: (results.organic?.length ?? 0) > 0 ? "verified" : "error",
          verification_source: "google",
          message: (results.organic?.length ?? 0) > 0 ? "Found matching results" : "No matching results found",
          searchResults: results
        };
      } catch (error) {
        console.error("Error processing reference:", reference.id, error);
        return {
          ...reference,
          status: "error",
          verification_source: "google",
          message: "Failed to verify reference"
        };
      }
    }
    async processBatch(references, onBatchComplete) {
      const processedRefs = [];
      let currentIndex = 0;
      while (currentIndex < references.length) {
        const batch = references.slice(currentIndex, currentIndex + BATCH_SIZE);
        console.log(
          `Processing batch ${currentIndex}-${currentIndex + batch.length}...`
        );
        const results = await Promise.all(
          batch.map((ref) => this.processReference(ref))
        );
        processedRefs.push(...results);
        console.log(
          `Batch results (${currentIndex}-${currentIndex + batch.length}):`,
          results
        );
        onBatchComplete(results);
        currentIndex += BATCH_SIZE;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      console.log("All references processed:", processedRefs);
      return processedRefs;
    }
  };

  // app/services/verify-reference-service.ts
  var BATCH_SIZE2 = 3;
  var VerifyReferenceService = class {
    async processReference(reference, keyIndex) {
      try {
        const response = await fetch("/api/references/openAI-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference,
            searchResults: reference.searchResults,
            keyIndex,
            maxRetries: 2
          })
        });
        if (!response.ok) {
          throw new Error("Failed to verify reference");
        }
        const result = await response.json();
        return {
          ...reference,
          status: result.status,
          verification_source: "analysis of search results",
          message: result.message
        };
      } catch (error) {
        return {
          ...reference,
          status: "error",
          verification_source: "analysis of search results",
          message: error instanceof Error ? error.message : "Failed to verify reference"
        };
      }
    }
    async processBatch(references, onBatchComplete) {
      const processedRefs = [];
      let currentIndex = 0;
      const unverifiedReferences = references.filter(
        (ref) => ref.status !== "verified"
      );
      console.log(
        `Skipping ${references.length - unverifiedReferences.length} already verified references.`
      );
      while (currentIndex < unverifiedReferences.length) {
        const batch = unverifiedReferences.slice(
          currentIndex,
          currentIndex + BATCH_SIZE2
        );
        console.log(
          `Processing verification batch: ${currentIndex}-${currentIndex + batch.length}`
        );
        const results = await Promise.all(
          batch.map((ref, index) => this.processReference(ref, index))
        );
        processedRefs.push(...results);
        onBatchComplete(results);
        currentIndex += BATCH_SIZE2;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return references.map((ref) => {
        const processedRef = processedRefs.find(
          (processed) => processed.id === ref.id
        );
        return processedRef || ref;
      });
    }
  };

  // app/services/url-content-verify-service.ts
  var URLContentVerifyService = class _URLContentVerifyService {
    static BATCH_SIZE = 5;
    // Adjust batch size as needed
    async verifyReferencesWithUrls(references) {
      const urlReferences = references.filter((ref) => ref.url);
      const verifiedReferences = [];
      let currentIndex = 0;
      while (currentIndex < urlReferences.length) {
        const batch = urlReferences.slice(
          currentIndex,
          currentIndex + _URLContentVerifyService.BATCH_SIZE
        );
        const batchResults = await Promise.all(
          batch.map(async (ref) => {
            try {
              const response = await fetch("/api/references/url-verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference: ref, maxRetries: 2 })
              });
              if (!response.ok) {
                throw new Error("Failed to verify URL content");
              }
              const result = await response.json();
              if (result.status === "verified") {
                return {
                  ...ref,
                  status: "verified",
                  message: result.message,
                  url_match: true
                };
              }
            } catch (error) {
              console.error("Error verifying URL content:", error);
            }
            return ref;
          })
        );
        verifiedReferences.push(...batchResults);
        currentIndex += _URLContentVerifyService.BATCH_SIZE;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const finalResults = references.map(
        (ref) => verifiedReferences.find((vRef) => vRef.id === ref.id) || ref
      );
      return finalResults;
    }
  };

  // app/utils/log-references.ts
  var logReferences = (references) => {
    console.log("\u{1F50D} References:");
    references.forEach((reference, index) => {
      console.log(`Reference #${index + 1}:`);
      console.log(`  Title: ${reference.title}`);
      console.log(`  Authors: ${reference.authors.join(", ")}`);
      console.log(`  Status: ${reference.status}`);
      console.log(`  Verification Source: ${reference.verification_source}`);
      console.log(`  Message: ${reference.message}`);
      console.log(`  Search Results:`);
      if (reference.searchResults?.organic?.length) {
        reference.searchResults.organic.forEach((result, i) => {
          console.log(`    Result #${i + 1}:`);
          console.log(`      Title: ${result.title}`);
          console.log(`      Link: ${result.link}`);
          console.log(`      Snippet: ${result.snippet}`);
        });
      } else {
        console.log("    No organic search results found.");
      }
      console.log("---");
    });
  };

  // app/services/workers/pdf.worker.ts
  var referenceService = new GrobidReferenceService("/api/grobid/references");
  var pdfReferenceService = new PDFParseAndExtractReferenceService(
    "/api/references/extract",
    "/api/parse-pdf"
  );
  var searchReferenceService = new SearchReferenceService();
  var verifyReferenceService = new VerifyReferenceService();
  var urlVerificationCheck = new URLContentVerifyService();
  self.onmessage = async (e) => {
    const { type, pdfId, file, highAccuracy } = e.data;
    if (type === "process") {
      console.log(`\u{1F680} Worker starting to process PDF ${pdfId}`);
      try {
        const references = await referenceService.extractReferences(file);
        let parsedRefernces = references;
        if (references.length === 0) {
          console.log(
            "No references found via GROBID, falling back to PDF parsing..."
          );
          parsedRefernces = await pdfReferenceService.parseAndExtractReferences(file);
          console.log("\u{1F4E5} Received references from OpenAI:", parsedRefernces);
        } else if (highAccuracy) {
          console.log("\u{1F50D} High Accuracy mode enabled. Verifying references...");
          const checkedReferences = [];
          for (const reference of parsedRefernces) {
            const response = await fetch("/api/high-accuracy-check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference })
            });
            if (!response.ok) {
              console.error("Error verifying reference:", reference);
              continue;
            }
            const result = await response.json();
            console.log("\u{1F50D} Verification result:", result);
            checkedReferences.push(...result);
          }
          parsedRefernces = checkedReferences;
        }
        console.log("\u{1F9F9} Removing duplicate references...");
        parsedRefernces = removeDuplicates(parsedRefernces);
        console.log("\u2705 Unique references:", parsedRefernces);
        console.log("\u{1F50D} Starting batch processing for search...");
        const referencesWithSearch = await searchReferenceService.processBatch(
          parsedRefernces,
          (batchResults) => {
            self.postMessage({
              type: "search-update",
              pdfId,
              message: "google searching..."
            });
          }
        );
        console.log("\u2705 search complete.");
        logReferences(referencesWithSearch);
        console.log("\u{1F310} Verifying references with URLs...");
        const urlVerifiedreferences = await urlVerificationCheck.verifyReferencesWithUrls(
          referencesWithSearch
        );
        console.log("\u2705 URL verification complete.");
        logReferences(urlVerifiedreferences);
        console.log("*** final verification ***");
        const verifiedReferences = await verifyReferenceService.processBatch(
          urlVerifiedreferences,
          (batchResults) => {
            self.postMessage({
              type: "verification-update",
              pdfId,
              message: "Verifying references...",
              batchResults
            });
          }
        );
        logReferences(verifiedReferences);
        self.postMessage({
          type: "complete",
          pdfId,
          references: verifiedReferences
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
  var removeDuplicates = (references) => {
    const uniqueSet = /* @__PURE__ */ new Map();
    references.forEach((ref) => {
      const key = `${ref.authors?.join(",")}|${ref.title}`;
      if (!uniqueSet.has(key)) {
        uniqueSet.set(key, ref);
      }
    });
    return Array.from(uniqueSet.values());
  };
})();
