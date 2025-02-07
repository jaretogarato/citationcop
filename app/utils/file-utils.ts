// utils/file-utils.ts
export async function convert2Pdf(file: File): Promise<File> {
    const formData = new FormData();
    formData.append('file', file, file.name);
  
    try {
      const response = await fetch('/api/doc-convert2PDF', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
      }
  
      const blob = await response.blob();
      return new File([blob], file.name.replace(/\.[^/.]+$/, '.pdf'), {
        type: 'application/pdf',
      });
    } catch (error) {
      console.error('File conversion failed:', error);
      throw error;
    }
  }
  