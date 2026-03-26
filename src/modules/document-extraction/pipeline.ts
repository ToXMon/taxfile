/**
 * Extraction Pipeline — Orchestrates the full document extraction flow.
 * File → OCR → detect type → mapper → confidence scoring → flag low-conf → ExtractedDocument
 */

import type { DocumentType, ExtractedDocument, TaxLineItem } from '@/lib/types';
import type { OCRResult } from './types';
import { extractTextFromFile } from './ocr/client-ocr';
import {
  getMapper,
  isSupported,
  detectDocumentType,
} from './mappers/index';

// ─── Configuration ──────────────────────────────────────────────────

/** Fields below this threshold get flagged for review */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

// ─── Confidence Post-Processing ─────────────────────────────────────

/**
 * Post-process mapper output: flag any field below the pipeline threshold.
 * Mappers flag at 0.5 internally; pipeline raises to 0.7.
 */
function applyConfidenceFlags(
  doc: ExtractedDocument,
 threshold: number,
): ExtractedDocument {
  const updatedFields: Record<string, TaxLineItem> = {};

  for (const [key, item] of Object.entries(doc.fields)) {
    const fieldConf = doc.confidence[key] ?? 0;
    if (fieldConf < threshold && !item.flagged) {
      updatedFields[key] = {
        ...item,
        flagged: true,
        flagReason: `Pipeline confidence ${Math.round(fieldConf * 100)}% below ${Math.round(threshold * 100)}% threshold`,
      };
    } else {
      updatedFields[key] = item;
    }
  }

  return { ...doc, fields: updatedFields };
}

// ─── Error Logging ──────────────────────────────────────────────────

function logError(file: string, message: string, context: string): void {
 try {
   const errors = JSON.parse(localStorage.getItem('taxfile_errors') ?? '[]');
   errors.push({ timestamp: new Date().toISOString(), file, message, context });
   localStorage.setItem('taxfile_errors', JSON.stringify(errors));
 } catch {
   // Silent fail — localStorage may be unavailable
 }
}

// ─── Main Pipeline ──────────────────────────────────────────────────

/**
 * Extract structured tax data from an uploaded file.
 * Full pipeline: OCR → type detection → field mapping → confidence flagging.
 *
 * @param file - Uploaded PDF or image file
 * @param typeHint - Optional DocumentType to skip auto-detection
 * @returns ExtractedDocument with all mapped fields and confidence scores
 * @throws Error if OCR fails or document type cannot be determined
 */
export async function extractDocument(
  file: File,
  typeHint?: DocumentType,
): Promise<ExtractedDocument> {
 // Step 1: OCR
  let ocrResult: OCRResult;
  try {
    ocrResult = await extractTextFromFile(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown OCR error';
    logError(file.name, msg, 'extractDocument:ocr');
    throw new Error(`OCR processing failed for ${file.name}: ${msg}`);
  }

  // Step 2: Determine document type
  let docType: DocumentType;

  if (typeHint && isSupported(typeHint)) {
    docType = typeHint;
  } else {
    const detection = detectDocumentType(ocrResult.fullText);
    if (!detection.detectedType) {
      logError(file.name, detection.reason, 'extractDocument:detection');
      throw new Error(
        `Cannot determine document type for ${file.name}: ${detection.reason}`,
      );
    }
    if (detection.confidence < 0.5) {
      logError(
        file.name,
        `Low detection confidence: ${detection.confidence}`,
        'extractDocument:detection',
      );
    }
    docType = detection.detectedType;
  }

  // Step 3: Route to mapper
  const mapper = getMapper(docType);
  if (!mapper) {
    logError(file.name, `No mapper for ${docType}`, 'extractDocument:mapper');
    throw new Error(`No mapper registered for document type: ${docType}`);
  }

  let extracted: ExtractedDocument;
  try {
    extracted = mapper(ocrResult);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown mapping error';
    logError(file.name, msg, 'extractDocument:mapping');
    throw new Error(`Field mapping failed for ${docType}: ${msg}`);
  }

  // Step 4: Post-process confidence flags
  const result = applyConfidenceFlags(extracted, LOW_CONFIDENCE_THRESHOLD);

  return result;
}

/**
 * Extract multiple documents in parallel.
 * @returns Array of successful extractions and array of error messages
 */
export async function extractDocuments(
  files: Array<{ file: File; typeHint?: DocumentType }>,
): Promise<{ results: ExtractedDocument[]; errors: string[] }> {
  const results: ExtractedDocument[] = [];
  const errors: string[] = [];

  const promises = files.map(async ({ file, typeHint }) => {
    try {
      const doc = await extractDocument(file, typeHint);
      results.push(doc);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${file.name}: ${msg}`);
    }
  });

  await Promise.all(promises);
  return { results, errors };
}
