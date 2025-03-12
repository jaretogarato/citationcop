import { RefPagesResult } from '@/app/types/reference'
import { ReferencePageDetectionService } from './o;d/reference-page-detection-service'

export class ReferencePageImageService {
  private refPageDetectionService: ReferencePageDetectionService

  constructor() {
    this.refPageDetectionService = new ReferencePageDetectionService()
  }

  /**
   * Initialize the service with a PDF file.
   */
  async initialize(file: File | ArrayBuffer | Blob): Promise<void> {
    await this.refPageDetectionService.initialize(file)
  }

  /**
   * Given a RefPagesResult (with pages and rawText) from the detect-pages API,
   * retrieves the image data for each page and returns an updated result.
   */
  async addImageData(refPagesResult: RefPagesResult): Promise<RefPagesResult> {
    const updatedImageData = await Promise.all(
      refPagesResult.pages.map(async (pageNum) => {
        try {
          const imageData = await this.refPageDetectionService.getPageImage(pageNum)
          return imageData
        } catch (error) {
          console.error(`Failed to get image for page ${pageNum}:`, error)
          return '' // Return empty string on error
        }
      })
    )

    return {
      pages: refPagesResult.pages,
      rawText: refPagesResult.rawText,
      imageData: updatedImageData
    }
  }

  /**
   * Clean up resources used by the detection service.
   */
  async cleanup(): Promise<void> {
    await this.refPageDetectionService.cleanup()
  }
}
