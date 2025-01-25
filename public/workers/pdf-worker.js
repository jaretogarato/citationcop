"use strict";
(() => {
  // app/utils/reference-helpers/reference-helpers.ts
  var areAuthorsSimilar = (authors1, authors2) => {
    if (Math.abs(authors1.length - authors2.length) > 1) return false;
    const normalizeAndSort = (authors) => authors.map((a) => a.toLowerCase().trim()).sort();
    const set1 = new Set(normalizeAndSort(authors1));
    const set2 = new Set(normalizeAndSort(authors2));
    let matches = 0;
    for (const author of set1) {
      if (set2.has(author)) matches++;
    }
    const threshold = Math.min(set1.size, set2.size) * 0.7;
    return matches >= threshold;
  };
  var filterInvalidReferences = (references) => {
    console.log("references into filter: ", references);
    const validRefs = references.filter((ref) => {
      const hasValidAuthors = Array.isArray(ref.authors) && ref.authors.length > 0;
      const hasValidTitle = typeof ref.title === "string" && ref.title.trim() !== "";
      return hasValidAuthors && hasValidTitle;
    });
    const uniqueRefs = [];
    for (const ref of validRefs) {
      const normalizedTitle = ref.title.toLowerCase().trim();
      let isDuplicate = false;
      for (const existingRef of uniqueRefs) {
        const existingTitle = existingRef.title.toLowerCase().trim();
        if (normalizedTitle === existingTitle && areAuthorsSimilar(existingRef.authors, ref.authors)) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        uniqueRefs.push(ref);
      }
    }
    console.log("references out filter: ", uniqueRefs);
    return uniqueRefs;
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
      const filteredReferences = filterInvalidReferences(references);
      return filteredReferences;
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
          status: (results.organic?.length ?? 0) > 0 ? "pending" : "error",
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
        const results = await Promise.all(
          batch.map((ref) => this.processReference(ref))
        );
        processedRefs.push(...results);
        onBatchComplete(results);
        currentIndex += BATCH_SIZE;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
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
      const result = [...references];
      const unverifiedRefs = references.map((ref, index) => ({ ref, originalIndex: index })).filter(({ ref }) => ref.status !== "verified");
      for (let i = 0; i < unverifiedRefs.length; i += BATCH_SIZE2) {
        const currentBatch = unverifiedRefs.slice(i, i + BATCH_SIZE2);
        const processedResults = await Promise.all(
          currentBatch.map(
            ({ ref }, batchIndex) => this.processReference(ref, batchIndex)
          )
        );
        processedResults.forEach((processedRef, batchIndex) => {
          const originalIndex = currentBatch[batchIndex].originalIndex;
          result[originalIndex] = processedRef;
        });
        onBatchComplete(processedResults);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return result;
    }
  };

  // app/services/url-content-verify-service.ts
  var URLContentVerifyService = class _URLContentVerifyService {
    static BATCH_SIZE = 5;
    // Adjust batch size as needed
    // Utility function to validate URLs
    isValidUrl(url) {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }
    async verifyReferencesWithUrls(references) {
      const urlReferences = references.filter(
        (ref) => ref.url && this.isValidUrl(ref.url)
      );
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
            return {
              ...ref,
              url_match: false,
              message: "URL verification failed"
            };
          })
        );
        verifiedReferences.push(...batchResults);
        currentIndex += _URLContentVerifyService.BATCH_SIZE;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const verifiedMap = new Map(verifiedReferences.map((ref) => [ref.id, ref]));
      return references.map((ref) => {
        const verifiedRef = verifiedMap.get(ref.id);
        return verifiedRef ? { ...ref, ...verifiedRef } : ref;
      });
    }
  };

  // app/utils/reference-helpers/log-references.ts
  var logSimpleReferences = (references) => {
    console.log("\u{1F50D} References -----------");
    references.forEach((reference, index) => {
      console.log(`** Reference #${index + 1}:`);
      console.log(`  Title: ${reference.title}`);
      console.log(`  Authors: ${reference.authors.join(", ")}`);
      console.log(`  Status: ${reference.status}`);
      console.log(`  Verification Source: ${reference.verification_source}`);
      console.log(`  Message: ${reference.message}`);
    });
  };

  // app/services/workers/pdf.worker.ts
  var pdfReferenceService = new PDFParseAndExtractReferenceService(
    "/api/references/extract",
    "/api/parse-pdf"
  );
  var searchReferenceService = new SearchReferenceService();
  var verifyReferenceService = new VerifyReferenceService();
  var urlVerificationCheck = new URLContentVerifyService();
  self.onmessage = async (e) => {
    const { type, pdfId, file } = e.data;
    if (type === "process") {
      try {
        let parsedReferences = await pdfReferenceService.parseAndExtractReferences(file);
        let noReferences = parsedReferences.length;
        self.postMessage({
          type: "references",
          pdfId,
          noReferences: parsedReferences.length,
          message: `After second reference check, ${noReferences} found for ${pdfId}`
        });
        const referencesWithSearch = await searchReferenceService.processBatch(
          parsedReferences,
          (batchResults) => {
            self.postMessage({
              type: "update",
              pdfId,
              message: `\u2705 search complete. for ${pdfId} `
            });
          }
        );
        console.log("***** AFTER search ******");
        logSimpleReferences(referencesWithSearch);
        const verifiedReferences = await verifyReferenceService.processBatch(
          referencesWithSearch,
          (batchResults) => {
            self.postMessage({
              type: "verification-update",
              pdfId,
              message: "Verifying references...",
              batchResults
            });
          }
        );
        console.log("****   MESSAGES After verification  ***");
        logSimpleReferences(verifiedReferences);
        self.postMessage({
          type: "complete",
          pdfId,
          references: verifiedReferences
        });
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
