# TaxFile — Scope Document

## Feature Summary
TaxFile is a full-stack web application for preparing IRS e-file-ready federal (Form 1040) and New Jersey state (NJ-1040) tax returns. Users upload tax documents (W-2s, 1099s, 1098s), the app extracts data via OCR/AI, maps extracted fields to the correct IRS form lines, calculates federal and NJ state taxes with all eligible deductions and credits, and produces completed tax forms as fillable PDFs with a full audit trail.

## User Story
As a US taxpayer filing in New Jersey, I want to upload my tax documents, have the app accurately extract and map data to IRS forms, calculate my federal and state tax liability with all applicable deductions and credits, and produce a complete, e-file-ready tax return — so that I can file my taxes accurately without paying for a tax professional.

## Success Criteria
1. A user can upload W-2, 1099-INT, 1099-DIV, 1099-B, 1099-NEC, 1098, 1098-E, 1098-T documents and get extracted data back for review/editing
2. The app produces a completed Form 1040 + all required schedules (1, 2, 3, A, B, D, 8812) as fillable PDFs matching official IRS layout
3. The app produces a completed NJ-1040 + schedules (A, B, C) as fillable PDFs
4. The calculated numbers for the reference scenario (MFJ + 1 child, W-2 + 1099-INT + 1098) match what a tax professional would produce
5. Every number on every form has an audit trail showing source document → form line → IRS publication section
6. The app handles: W-2 income, interest income, dividend income, capital gains, mortgage interest deduction, student loan interest deduction, child tax credit (with phase-out), NJ property tax deduction
7. Tax brackets, deduction amounts, and credit limits are configurable by tax year (2025 values shipped as default)

## Modules Affected

```
taxfile/
├── src/
│   ├── app/                          # Next.js app router pages + API routes
│   │   ├── page.tsx                  # Landing page with disclaimer
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── globals.css               # Design tokens + Tailwind
│   │   ├── api/
│   │   │   ├── extract/route.ts      # Document OCR extraction endpoint
│   │   │   ├── calculate/route.ts    # Tax calculation endpoint
│   │   │   ├── forms/route.ts        # Form generation endpoint
│   │   │   └── documents/route.ts    # Document CRUD endpoint
│   │   └── return/
│   │       ├── page.tsx              # Wizard entry point
│   │       └── [id]/
│   │           ├── review/page.tsx   # Review extracted data
│   │           ├── questions/page.tsx # Additional questions
│   │           ├── summary/page.tsx  # Tax summary dashboard
│   │           └── forms/page.tsx    # Generated forms viewer
│   ├── modules/
│   │   ├── document-extraction/      # OCR + field mapping
│   │   ├── tax-engine/               # Federal + NJ calculations
│   │   ├── forms-generation/         # PDF rendering
│   │   └── user-flow/                # Wizard orchestration
│   ├── lib/
│   │   ├── types.ts                  # Centralized type definitions
│   │   ├── db/                       # Database interface pattern
│   │   └── utils.ts                  # Shared utilities
│   ├── config/
│   │   └── tax-year/
│   │       └── 2025/                 # 2025 tax parameters
│   ├── stores/                       # Zustand stores
│   └── components/                   # Shared UI components
├── data/                             # Pipeline test output (gitignored)
├── docs/state/                       # State diagrams (gitignored)
├── AGENTS.md                         # Root documentation
└── HARNESS.md                        # Development harness
```

## Data Flow

```
Document Upload (PDF/Image)
  → Document Extraction Module
    → OCR Processing (Tesseract.js client-side, sharp+tesseract server fallback)
    → Field Mapping (per form type: W-2, 1099-INT, etc.)
    → Confidence Scoring (per field)
    → Structured ExtractedData JSON
  → User Review/Edit Step
    → VerifiedExtractedData JSON
  → Tax Engine Module
    → Income Aggregation (Schedule 1, B)
    → Deduction Resolution (Standard vs Itemized comparison)
    → Federal Tax Calculation (1040 + schedules)
    → NJ State Tax Calculation (NJ-1040 + schedules)
    → Credit Application (CTC, EITC, education credits, NJ credits)
    → CompleteTaxReturn JSON (with audit trail per line)
  → Forms Generation Module
    → @react-pdf/renderer components per form
    → Fillable PDF output per form
  → User Review + Download
```

## Interface Contracts

### Extracted Document Types
```typescript
interface ExtractedDocument {
  id: string;
  type: 'W2' | '1099-INT' | '1099-DIV' | '1099-B' | '1099-NEC' | '1099-MISC' | '1098' | '1098-T' | '1098-E' | '1095-A' | '1095-B' | '1095-C';
  fields: Record<string, TaxLineItem>;
  confidence: Record<string, number>; // field path → 0-1
  sourceFile: string;
  reviewed: boolean;
}

interface TaxLineItem {
  value: number;
  label: string;
  source: {
    documentId: string;
    formType: string;
    boxNumber: string;
  };
  trace: {
    irsPublication?: string;
    njTaxCode?: string;
    calculationNote?: string;
  };
  flagged: boolean;
  flagReason?: string;
}
```

### Tax Return Output
```typescript
interface CompleteTaxReturn {
  taxpayer: TaxpayerInfo;
  taxYear: number;
  federal: {
    form1040: Record<string, TaxLineItem>;  // line number → value
    schedule1: Record<string, TaxLineItem>;
    schedule2: Record<string, TaxLineItem>;
    schedule3: Record<string, TaxLineItem>;
    scheduleA: Record<string, TaxLineItem>;
    scheduleB: Record<string, TaxLineItem>;
    scheduleD: Record<string, TaxLineItem>;
    schedule8812: Record<string, TaxLineItem>;
  };
  newJersey: {
    nj1040: Record<string, TaxLineItem>;
    scheduleA: Record<string, TaxLineItem>;
    scheduleB: Record<string, TaxLineItem>;
    scheduleC: Record<string, TaxLineItem>;
  };
  summary: TaxSummary;
  auditTrail: AuditTrailEntry[];
}

interface TaxSummary {
  totalIncome: number;
  adjustments: number;
  deductions: number;
  taxableIncome: { federal: number; state: number };
  federalTax: number;
  stateTax: number;
  totalTax: number;
  totalPayments: number;
  refundOrOwed: number;
  effectiveRate: number;
}
```

### API Contracts

**POST /api/extract** — Upload and extract document
- Input: FormData with file + document type hint
- Output: ExtractedDocument JSON

**POST /api/calculate** — Run full tax calculation
- Input: { taxpayer: TaxpayerInfo, documents: ExtractedDocument[], answers: AdditionalAnswers }
- Output: CompleteTaxReturn JSON

**POST /api/forms** — Generate PDF forms
- Input: CompleteTaxReturn JSON
- Output: Array of { formName: string, pdfBuffer: Buffer }

**CRUD /api/documents** — Manage uploaded documents
- GET: list documents for a return
- POST: upload new document
- PUT: update reviewed/edited document
- DELETE: remove document

### Database Schema (JSON mock shape)
```typescript
interface TaxReturnRecord {
  id: string;
  taxYear: number;
  taxpayer: TaxpayerInfo;
  documents: ExtractedDocument[];
  additionalAnswers: AdditionalAnswers;
  calculatedReturn: CompleteTaxReturn | null;
  status: 'draft' | 'in-progress' | 'review' | 'complete';
  createdAt: string;
  updatedAt: string;
}
```

## Dependencies

### External Packages
- `next@14` — Framework
- `react@18` + `react-dom@18` — UI library
- `typescript@5` — Type system (strict mode)
- `tesseract.js` — Client-side OCR
- `sharp` — Image processing (server-side OCR fallback)
- `tesseract` — Server-side OCR binary
- `@react-pdf/renderer` — PDF generation from React components
- `zustand` — Client state management
- `tailwindcss` — Utility CSS
- `shadcn/ui` components: button, card, input, label, select, tabs, progress, tooltip, dialog, alert, badge, separator, sheet, scroll-area, accordion
- `class-variance-authority` — Component variants
- `clsx` + `tailwind-merge` — Class utilities
- `lucide-react` — Icons
- `zod` — Runtime validation
- `uuid` — ID generation

### Internal Module Dependencies
- `user-flow` depends on `document-extraction`, `tax-engine`, `forms-generation`
- `tax-engine` depends on `src/config/tax-year/` for bracket/deduction/credit values
- `forms-generation` depends on `tax-engine` output types
- `document-extraction` is fully independent
- All modules depend on `src/lib/types.ts`

## Reference Scenario Detail

Filing Status: Married Filing Jointly (MFJ)
State: New Jersey
Dependents: 1 qualifying child (under 17)
Documents: W-2, 1099-INT, 1098 (mortgage interest)
Expected handling:
- Standard deduction: $29,200 (2025 MFJ) — compare against itemized (mortgage interest + property taxes capped at $10,000 SALT)
- Child Tax Credit: $2,000 (phase-out begins at $400,000 MFJ AGI for 2025)
- NJ Property Tax Deduction: $1,000 max or actual property taxes paid (whichever is less)
- NJ Earned Income Tax Credit: 40% of federal EITC (if eligible)
- NJ does NOT have a standard deduction — uses federal standard or itemized

## Non-Negotiable Constraints
1. Tax accuracy is paramount — every calculation traceable to IRS publication or NJ tax code section
2. PII protection — SSNs encrypted, never logged, masked in non-encrypted contexts
3. Not legal advice — disclaimers at all entry points
4. 2025 tax year values — configurable, not hardcoded
5. No external tax calculation libraries — pure TypeScript from source publications
