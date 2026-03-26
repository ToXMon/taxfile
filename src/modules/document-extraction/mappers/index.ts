/**
 * Mapper Registry — Maps DocumentType to mapper function.
 * Also provides auto-detection for unknown document types.
 */

import type { DocumentType } from '@/lib/types';
import type { ExtractedDocument } from '@/lib/types';
import type { OCRResult } from '../types';
import { mapW2 } from './w2-mapper';
import { map1099Int } from './1099-int-mapper';
import { map1099Div } from './1099-div-mapper';
import { map1099B } from './1099-b-mapper';
import { map1099Nec, map1099Misc, detectNECorMISC } from './1099-nec-misc-mapper';
import { map1098, map1098E, map1098T, detect1098Variant } from './1098-family-mapper';

// ─── Mapper Function Type ───────────────────────────────────────────

export type MapperFn = (ocrResult: OCRResult) => ExtractedDocument;

// ─── Registry ───────────────────────────────────────────────────────

const MAPPER_REGISTRY: Partial<Record<DocumentType, MapperFn>> = {
  'W2': mapW2,
  '1099-INT': map1099Int,
  '1099-DIV': map1099Div,
  '1099-B': map1099B,
  '1099-NEC': map1099Nec,
  '1099-MISC': map1099Misc,
  '1098': map1098,
  '1098-E': map1098E,
  '1098-T': map1098T,
};

/** Get a mapper function for a known document type */
export function getMapper(type: DocumentType): MapperFn | undefined {
  return MAPPER_REGISTRY[type];
}

/** Check if a document type is supported */
export function isSupported(type: DocumentType): boolean {
  return type in MAPPER_REGISTRY;
}

// ─── Auto-Detection ─────────────────────────────────────────────────

export interface DetectionResult {
  detectedType: DocumentType | null;
  confidence: number;
  reason: string;
}

/**
 * Auto-detect document type from OCR text.
 * Checks form-specific keywords in priority order.
 */
export function detectDocumentType(text: string): DetectionResult {
  const lower = text.toLowerCase();

  // W-2 (check early — very common)
  if (lower.includes('w-2') || lower.includes('wage and tax statement')) {
    return { detectedType: 'W2', confidence: 0.9, reason: 'Found W-2 header' };
  }

  // 1099 sub-forms (check specific before generic)
 if (lower.includes('1099-int') || lower.includes('interest income')) {
    return { detectedType: '1099-INT', confidence: 0.85, reason: 'Found 1099-INT header' };
  }
  if (lower.includes('1099-div') || lower.includes('dividend')) {
    return { detectedType: '1099-DIV', confidence: 0.85, reason: 'Found 1099-DIV header' };
  }
  if (lower.includes('1099-b') || lower.includes('proceeds')) {
    return { detectedType: '1099-B', confidence: 0.8, reason: 'Found 1099-B header' };
  }

  // 1098 family
  const variant1098 = detect1098Variant(text);
  if (variant1098 !== 'unknown') {
    return {
      detectedType: variant1098 as DocumentType,
      confidence: 0.85,
      reason: `Detected ${variant1098} from header`,
    };
  }

  // 1099-NEC vs 1099-MISC
  const necMisc = detectNECorMISC(text);
  if (necMisc !== 'unknown') {
    return {
      detectedType: necMisc as DocumentType,
      confidence: 0.85,
      reason: `Detected ${necMisc} from header`,
    };
  }

  // Generic 1099 fallback
  if (lower.includes('1099')) {
    return { detectedType: '1099-NEC', confidence: 0.4, reason: 'Generic 1099 — defaulting to NEC' };
  }

  return { detectedType: null, confidence: 0, reason: 'No known form type detected' };
}
