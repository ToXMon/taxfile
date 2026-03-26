/**
 * Server-Side OCR — sharp preprocessing + Tesseract.js Node API
 * Fallback when client-side OCR produces low-confidence results.
 * Runs only on Node.js (server-side). Same OCRResult type as client-ocr.
 */

import sharp from 'sharp';
import type { OCRResult, OCRPageResult, OCRWord } from '../types';

/** Supported input MIME types */
const SUPPORTED_MIMES = [
  'image/png', 'image/jpeg', 'image/tiff', 'image/bmp',
  'application/pdf',
] as const;

/** Validate MIME type is supported */
function validateMime(mime: string): void {
  if (!SUPPORTED_MIMES.includes(mime as typeof SUPPORTED_MIMES[number])) {
    throw new Error(`Unsupported MIME type: ${mime}`);
  }
}

/**
 * Preprocess an image buffer for better OCR accuracy.
 * Pipeline: convert to grayscale → increase contrast → sharpen.
 */
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  const pipeline = sharp(buffer)
    .grayscale()
    .normalize() // auto-stretch contrast
    .sharpen({ sigma: 0.5, m1: 0.5, m2: 0.5 });

  return pipeline.toBuffer();
}

/** Convert a PDF buffer to individual page image buffers via pdfjs-dist */
async function pdfToImageBuffers(
  pdfBuffer: Buffer,
): Promise<Buffer[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
  const pages: Buffer[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const { default: canvas } = await import('canvas');
    const cv = canvas.createCanvas(viewport.width, viewport.height);
    const ctx = cv.getContext('2d');

    // @ts-expect-error pdfjs-dist type mismatch in Node.js
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(cv.toBuffer('image/png'));
  }

  return pages;
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

/** Run Tesseract.js on a single image buffer */
async function recognizeBuffer(
  imageBuffer: Buffer,
  pageNumber: number,
): Promise<OCRPageResult> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', undefined, {
    logger: () => {},
  });

  try {
    const { data } = await worker.recognize(imageBuffer);
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
  } finally {
    await worker.terminate();
  }
}

/**
 * Extract text from a buffer using server-side OCR.
 * Supports PDF (multi-page) and image formats.
 * Applies sharp preprocessing for better accuracy.
 *
 * @param buffer - Raw file buffer
 * @param mime - MIME type (image/png, image/jpeg, application/pdf, etc.)
 * @param sourceFile - Original filename for traceability
 * @returns Structured OCRResult with per-page data
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mime: string,
  sourceFile: string,
): Promise<OCRResult> {
  validateMime(mime);

  let imageBuffers: Buffer[];

  if (mime === 'application/pdf') {
    imageBuffers = await pdfToImageBuffers(buffer);
  } else {
    imageBuffers = [buffer];
  }

  const pages: OCRPageResult[] = [];

  for (let i = 0; i < imageBuffers.length; i++) {
    const preprocessed = await preprocessImage(imageBuffers[i]);
    const pageResult = await recognizeBuffer(preprocessed, i + 1);
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
    sourceFile,
  };
}
