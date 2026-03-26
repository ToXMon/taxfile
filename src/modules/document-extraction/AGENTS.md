# Document Extraction Module

## Purpose
Extract structured tax data from uploaded documents (W-2, 1099 series, 1098 series) via OCR processing, map extracted fields to the correct form line positions, and assign confidence scores per field.

## How It Works

1. **OCR Processing** — Client-side Tesseract.js processes uploaded PDF/image. Server-side fallback via sharp + tesseract binary for low-confidence results.
2. **Field Mapping** — Raw OCR text is parsed per document type using type-specific field mappers. Each mapper knows the box/field positions for its form.
3. **Confidence Scoring** — Each extracted field gets a 0–1 confidence score based on OCR confidence + field format validation (e.g., SSN pattern match, dollar amount pattern).
4. **Output** — Structured `ExtractedDocument` JSON with `TaxLineItem` values carrying full trace metadata.

## Type Contracts

### Input
- `File` (from upload) + optional `DocumentType` hint
- Falls back to auto-detection if no hint provided

### Output
- `ExtractedDocument` (from `src/lib/types.ts`)
  - `fields: Record<string, TaxLineItem>` — field path → value with trace
  - `confidence: Record<string, number>` — field path → 0–1
  - `sourceFile: string` — original filename
  - `reviewed: boolean` — false on extraction, true after user review

### Internal Types
- `FieldMapping` — maps OCR region → field path
- `OCRResult` — raw text + per-word confidence from Tesseract
- `ExtractionResult` — intermediate before conversion to ExtractedDocument

## Dependencies

### Internal
- `src/lib/types.ts` — ExtractedDocument, TaxLineItem, DocumentType
- `src/lib/utils.ts` — formatting helpers

### External
- `tesseract.js` — client-side OCR
- `sharp` — image preprocessing (server-side fallback)

### No Cross-Module Imports
This module does NOT import from tax-engine, forms-generation, or user-flow. Communication is through shared types only.

## File Structure Plan

```
document-extraction/
├── AGENTS.md
├── types.ts              # Module-internal types (FieldMapping, OCRResult, etc.)
├── ocr/
│   ├── client-ocr.ts     # Tesseract.js client-side extraction
│   └── server-ocr.ts     # sharp + tesseract server fallback
├── mappers/
│   ├── index.ts          # Mapper registry
│   ├── w2-mapper.ts      # W-2 field mapping
│   ├── 1099-int-mapper.ts
│   ├── 1099-div-mapper.ts
│   ├── 1099-b-mapper.ts
│   ├── 1099-nec-mapper.ts
│   ├── 1098-mapper.ts    # Covers 1098, 1098-E, 1098-T
│   └── detect-type.ts    # Auto-detect document type from OCR text
├── confidence.ts         # Confidence scoring logic
├── extract.ts            # Main extraction orchestrator
└── index.ts              # Public API exports
```

## Module-Specific Standards

- All field mappers return `Record<string, TaxLineItem>` — never raw strings/numbers
- Every TaxLineItem must have `source.formType` and `source.boxNumber` populated
- Confidence below 0.5 triggers `flagged: true` on the TaxLineItem
- Document type auto-detection uses keyword matching on OCR text (e.g., "W-2", "1099-INT")
- No PII in logs — SSN fields masked before any console output
