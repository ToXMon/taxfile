# TaxFile — Agent Documentation

## Purpose
Full-stack web application for preparing IRS e-file-ready federal (Form 1040) and New Jersey state (NJ-1040) tax returns. Users upload tax documents, the app extracts data via OCR, calculates taxes, and produces completed tax forms as fillable PDFs.

## Tech Stack
- **Framework**: Next.js 14 (App Router) with TypeScript strict mode
- **UI**: Tailwind CSS + shadcn/ui components (slate base color)
- **State**: Zustand (client-side UI state only)
- **OCR**: Tesseract.js (client-side) + sharp/tesseract (server-side fallback)
- **PDF**: @react-pdf/renderer
- **Database**: JSON flat-file (dev) / Prisma + PostgreSQL (prod)
- **Tax Engine**: Pure TypeScript — no external tax library
- **Runtime**: Node.js 20+

## Module Map

| Directory | Purpose |
|---|---|
| `src/app/` | Next.js pages + API routes |
| `src/modules/document-extraction/` | OCR processing, field mapping, confidence scoring |
| `src/modules/tax-engine/` | Federal + NJ state tax calculations |
| `src/modules/forms-generation/` | PDF rendering of completed tax forms |
| `src/modules/user-flow/` | Wizard steps, progress tracking, UI orchestration |
| `src/lib/types.ts` | Centralized type definitions |
| `src/lib/db/` | Database interface pattern (JSON + Prisma) |
| `src/lib/utils.ts` | Shared utilities (cn helper) |
| `src/config/tax-year/2025/` | 2025 tax parameters (brackets, deductions, credits) |
| `src/stores/` | Zustand stores |
| `src/components/ui/` | shadcn/ui components |
| `data/` | Pipeline test output (gitignored, synthetic data only) |
| `docs/state/` | State diagrams archive |

## Global Standards

### Type System
- No `any` types — use `unknown` + explicit cast when genuinely unknown
- All types centralized in `src/lib/types.ts` or module-specific type files
- Every calculated value carries `TaxLineItem` metadata (source, trace, flagged)

### File Limits
- Maximum 300 lines per file
- Maximum 20 files per directory
- Split before hitting limits

### Tax-Specific Rules
- Never guess a tax calculation — flag ambiguities with `TaxCalculationFlag`
- All tax amounts (brackets, deductions, credits) in config files under `src/config/tax-year/2025/`
- No tax literals in calculation code
- Every number has audit trail: source document → form line → IRS publication section

### PII Protection
- SSNs never in logs, console, or /data/ outputs
- Masked SSN format (XXX-XX-1234) in all non-encrypted contexts
- Document storage paths must not include PII
- /data/ contains only synthetic test data

### AGENTS.md First
Before modifying any module directory, check if AGENTS.md exists. If not, create one before proceeding.


### Build Status
- **All 65 tasks COMPLETE** (2026-03-26)
- TypeScript compiles clean: 0 errors
- Modules: document-extraction, tax-engine (federal + NJ), forms-generation, user-flow, API routes
- PDF forms: Form 1040, Schedules 1/2/3/A/B/D/8812, NJ-1040, NJ Schedules A/B/C
- Wizard: Upload -> Review -> Questions -> Summary -> Forms (5 steps)
- API: POST /api/documents/extract, CRUD /api/documents, POST /api/calculate, POST /api/forms
- Validation: missing doc detection, inconsistency detection, audit triggers, dependent checks
- Tests: extraction, federal calc, NJ calc, full pipeline, audit trail (data/test-results/)
- State diagrams: docs/state/ (tax-calculation-pipeline.mmd, user-flow.mmd, document-extraction.mmd)

### Key Patterns
- `makeLine()` helper creates TaxLineItem with source/trace/flagged metadata
- `toConfigFS()` maps 'qw' -> 'hoh' for filing status lookup
- Conditional form inclusion in assembler: hasData() for schedules, hasNonZeroValues() for calculated forms
- Zod validation on all API routes with exact TaxLineItem/TaxLineItemTrace schemas
- File creation via Python `open().write()` to avoid shell smart-quote encoding issues
- Inline styles in react-pdf components (Record<string,unknown> incompatible with Style type)

### Dependencies Added
- `zustand` (state management with persist middleware)
- `zod` (API validation schemas)
- `jszip` (ZIP download of PDF forms)

### Disclaimer
All entry points must include: "TaxFile is a self-preparation tool, not professional tax advice. Results should be reviewed by a qualified tax professional before filing."
