import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PdfPageImage {
  pageNumber: number;
  dataUrl: string;      // full data URL (data:image/jpeg;base64,...)
  base64: string;       // raw base64 content only
  width: number;
  height: number;
}

/**
 * Renders all pages of a PDF file to JPEG images client-side.
 * Returns an array of base64-encoded page images.
 */
export async function pdfToImages(
  file: File,
  options: { scale?: number; quality?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<PdfPageImage[]> {
  const { scale = 2, quality = 0.85, onProgress } = options;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  const images: PdfPageImage[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.split(',')[1];

    images.push({
      pageNumber: i,
      dataUrl,
      base64,
      width: viewport.width,
      height: viewport.height,
    });

    onProgress?.(i, totalPages);

    // Clean up
    canvas.width = 0;
    canvas.height = 0;
  }

  return images;
}
