"use strict";
(() => {
  // app/services/workers/pdf.worker.ts
  self.onmessage = async (e) => {
    const { type, pdfId, file } = e.data;
    if (type === "process") {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        self.postMessage({
          type: "complete",
          pdfId
        });
      } catch (error) {
        self.postMessage({
          type: "error",
          pdfId,
          error: error.message
        });
      }
    }
  };
})();
