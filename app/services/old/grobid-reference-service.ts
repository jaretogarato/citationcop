import { Reference } from '@/app/types/reference';

export class GrobidReferenceService {
  constructor(private grobidEndpoint: string) {}

  async extractReferences(file: File): Promise<Reference[]> {
    try {
      const references = await this.extractWithGrobid(file);
      return references;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Reference extraction failed: ${errorMessage}`);
    }
  }

  private async extractWithGrobid(file: File): Promise<Reference[]> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(this.grobidEndpoint, {
      method: 'POST',
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
}