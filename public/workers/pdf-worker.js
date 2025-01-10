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
      const processedRefs = [];
      let currentIndex = 0;
      const unverifiedReferences = references.filter(
        (ref) => ref.status !== "verified"
      );
      while (currentIndex < unverifiedReferences.length) {
        const batch = unverifiedReferences.slice(
          currentIndex,
          currentIndex + BATCH_SIZE2
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
      const urlReferences = references.filter((ref) => ref.url && this.isValidUrl(ref.url));
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
      try {
        const references = await referenceService.extractReferences(file);
        let parsedRefernces = references;
        if (references.length === 0) {
          parsedRefernces = await pdfReferenceService.parseAndExtractReferences(file);
        } else if (highAccuracy) {
          console.log("\u{1F50D} High Accuracy mode enabled. Verifying references...");
          const checkedReferences = [];
          for (const reference of parsedRefernces) {
            console.log("Checking reference:", {
              id: reference.id,
              title: reference.title
            });
            const response = await fetch("/api/high-accuracy-check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference })
            });
            if (!response.ok) {
              console.error("Error verifying reference:", reference);
              reference.status = "error";
              reference.message = "Verification failed";
              checkedReferences.push(reference);
              continue;
            }
            const result = await response.json();
            if (Array.isArray(result)) {
              if (result.length === 1 && result[0].ok === true) {
                checkedReferences.push({
                  ...reference,
                  status: "verified",
                  message: "Reference verified correct"
                });
              } else {
                result.forEach((correctedRef, index) => {
                  checkedReferences.push({
                    ...correctedRef,
                    id: correctedRef.id || `${reference.id}-${index + 1}`,
                    status: "verified",
                    message: "Reference corrected/expanded"
                  });
                });
              }
            } else {
              console.error("Unexpected response format:", result);
              reference.status = "error";
              reference.message = "Invalid verification response";
              checkedReferences.push(reference);
            }
          }
          parsedRefernces = checkedReferences;
        }
        parsedRefernces = removeDuplicates(parsedRefernces);
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
        const urlVerifiedreferences = await urlVerificationCheck.verifyReferencesWithUrls(
          referencesWithSearch
        );
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
