/**
 * Document Extraction — Module Internal Types
 * Not shared across modules. For cross-module types, see src/lib/types.ts.
 */

/** Single word from OCR with position and confidence */
export interface OCRWord {
  text: string;
  confidence: number; // 0–1
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

/** Single page OCR result */
export interface OCRPageResult {
  pageNumber: number;
  text: string;
  confidence: number; // average 0–1
  words: OCRWord[];
}

/** Full OCR result across all pages */
export interface OCRResult {
  pages: OCRPageResult[];
  fullText: string; // concatenated all pages
  overallConfidence: number; // average across all pages
  sourceFile: string;
}

/** Maps a field path to an OCR region/pattern */
export interface FieldMapping {
  fieldPath: string;
  label: string;
  boxNumber: string;
  /** Regex pattern to find the value after the label */
  pattern: RegExp;
  /** Which page to search (0-indexed, -1 = any) */
  pageHint: number;
}

/** Intermediate extraction result before conversion to ExtractedDocument */
export interface ExtractionResult {
  documentType: string;
  fields: Record<string, string | number>; // raw extracted values
  confidence: Record<string, number>;
  ocrResult: OCRResult;
}
