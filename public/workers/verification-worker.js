"use strict";
(() => {
  // app/services/search-reference-service.ts
  var BATCH_SIZE = 3;
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
        await new Promise((resolve) => setTimeout(resolve, 250));
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

  // app/services/workers/verification.worker.ts
  var searchReferenceService = new SearchReferenceService();
  var verifyReferenceService = new VerifyReferenceService();
  async function convertPdfToImages(file) {
    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("range", "1-");
    try {
      console.log("Making request to pdf2images endpoint...");
      const response = await fetch("/api/pdf2images", {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        console.error("PDF to images response not OK:", response.status, response.statusText);
        throw new Error(`Failed to convert PDF to images: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.images || !Array.isArray(data.images)) {
        console.error("Invalid images data received:", data);
        throw new Error("Invalid image data received from conversion");
      }
      const formattedImages = data.images.map((img) => `data:image/png;base64,${img}`);
      if (formattedImages.length > 0) {
        console.log(
          "First image data preview (after formatting):",
          formattedImages[0].substring(0, 100) + "..."
        );
      }
      return formattedImages;
    } catch (error) {
      console.error("Error in convertPdfToImages:", error);
      throw error;
    }
  }
  async function extractReferencesFromImage(imageData) {
    try {
      const response = await fetch("/api/open-ai-vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ imageData })
      });
      if (!response.ok) {
        throw new Error("Failed to extract references from image");
      }
      const data = await response.json();
      return data.references || [];
    } catch (error) {
      console.error("Error extracting references from image:", error);
      return [];
    }
  }
  self.onmessage = async (e) => {
    const { type, pdfId, file } = e.data;
    if (type === "process") {
      try {
        self.postMessage({
          type: "update",
          pdfId,
          message: `Worker launched for : ${pdfId}`
        });
        self.postMessage({
          type: "update",
          pdfId,
          message: `Converting PDF to images: ${pdfId}`
        });
        const images = await convertPdfToImages(file);
        if (images.length === 0) {
          throw new Error("No images extracted from PDF");
        }
        self.postMessage({
          type: "update",
          pdfId,
          message: `Extracting references from ${images.length} pages`
        });
        const allReferences = [];
        for (let i = 0; i < images.length; i++) {
          const pageReferences = await extractReferencesFromImage(images[i]);
          allReferences.push(...pageReferences);
          self.postMessage({
            type: "update",
            pdfId,
            message: `Processed page ${i + 1}/${images.length}`
          });
        }
        const noReferences = allReferences.length;
        self.postMessage({
          type: "references",
          pdfId,
          noReferences,
          message: `Found ${noReferences} references for ${pdfId}`
        });
        console.log("Starting batch processing for search...");
        const referencesWithSearch = await searchReferenceService.processBatch(
          allReferences,
          (batchResults) => {
            self.postMessage({
              type: "update",
              pdfId,
              message: `\u2705 search complete for ${pdfId}`
            });
          }
        );
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
