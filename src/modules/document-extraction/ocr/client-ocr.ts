/**
 * Client-Side OCR — Tesseract.js Wrapper
 * Processes PDF and image files in the browser.
 * Falls back to server-side OCR for low-confidence results (handled by caller).
 */

import type { OCRResult, OCRPageResult, OCRWord } from '../types';

// Tesseract worker is loaded dynamically to avoid SSR issues
let workerPromise: Promise<unknown> | null = null;

async function getWorker() {
  if (!workerPromise) {
    const { createWorker } = await import('tesseract.js');
    workerPromise = createWorker('eng', undefined, {
      logger: () => {}, // suppress noisy logs
    });
  }
  return workerPromise;
}

/** Terminate the worker to free resources */
export async function terminateOCRWorker(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    const { terminate } = worker as { terminate: () => Promise<void> };
    await terminate();
    workerPromise = null;
  }
}

/** Check if a file is a PDF based on MIME type or extension */
function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Convert a PDF file to an array of image data URLs */
async function pdfToImages(file: File): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // @ts-expect-error pdfjs-dist type mismatch in Next.js
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL('image/png'));
    canvas.remove();
  }

  return images;
}

/** Convert a File to a single data URL (image only) */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Parse Tesseract word-level data into OCRWord[] */
function parseWords(data: unknown): OCRWord[] {
  const result = data as {
    words?: Array<{
      text: string;
      confidence: number;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }>;
  };
  if (!result.words) return [];
  return result.words.map((w) => ({
    text: w.text,
    confidence: w.confidence / 100, // Tesseract returns 0-100
    bbox: w.bbox,
  }));
}

/** Run OCR on a single image data URL */
async function recognizeImage(
  dataUrl: string,
  pageNumber: number,
): Promise<OCRPageResult> {
  const worker = await getWorker();
  const { recognize } = worker as {
    recognize: (img: string) => Promise<{
      data: { text: string; confidence: number; words: unknown };
    }>;
  };

  const { data } = await recognize(dataUrl);
  const words = parseWords(data);
  const avgConfidence =
    words.length > 0
      ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
      : data.confidence / 100;

  return {
    pageNumber,
    text: data.text,
    confidence: Math.round(avgConfidence * 1000) / 1000,
    words,
  };
}

/**
 * Extract text from a file using client-side OCR.
 * Supports PDF (multi-page via pdfjs-dist) and image files.
 *
 * @param file - The uploaded file (PDF or image)
 * @returns Structured OCRResult with per-page data
 */
export async function extractTextFromFile(file: File): Promise<OCRResult> {
  let imageUrls: string[];

  if (isPDF(file)) {
    imageUrls = await pdfToImages(file);
  } else {
    imageUrls = [await fileToDataUrl(file)];
  }

  const pages: OCRPageResult[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const pageResult = await recognizeImage(imageUrls[i], i + 1);
    pages.push(pageResult);
  }

  const fullText = pages.map((p) => p.text).join('\n--- PAGE BREAK ---\n');
  const overallConfidence =
    pages.length > 0
      ? pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length
      : 0;

  return {
    pages,
    fullText,
    overallConfidence: Math.round(overallConfidence * 1000) / 1000,
    sourceFile: file.name,
  };
}
