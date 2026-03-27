# TaxFile Workpack — Agent Behavioral Rules

## Universal Autonomy Rules

### NO QUESTIONS POLICY
Do not ask clarifying questions during task execution. Make a technical decision based on available context, implement it, and document the decision in the task file's DECISIONS LOG section.

### NO STOP ON ERROR
Non-blocking errors must be logged to `/data/errors.json` with timestamp, file, error message, and context. Execution continues. Blocking errors (compilation failures, missing dependencies) may stop the current task file but not the entire workpack.

### SELF-DECISION POLICY
When faced with ambiguity (naming, structure, implementation approach), choose the option that minimizes total lines of code and maximizes module isolation. Document the decision.

## File & Code Standards

### FILE LIMIT ENFORCEMENT
Before writing any file, check its line count. If it would exceed 300 lines, split into sub-files immediately. If a directory would exceed 20 files, create a subdirectory.

### TYPE STRICTNESS
No `any` types. All new types go to the centralized types module (`src/lib/types.ts` or module-specific types files). Use `unknown` + explicit cast when type is genuinely unknown.

### AGENTS.md FIRST
Before modifying any module, check if AGENTS.md exists in that directory. If not, create one before proceeding with the task.

## Tax-Specific Rules

### NEVER GUESS A TAX CALCULATION
If the IRS publication or NJ tax code is ambiguous, flag it for human review rather than estimating. Implement a `TaxCalculationFlag` type that marks uncertain calculations with the source publication section and reason for ambiguity.

### TRACEABILITY REQUIREMENT
Every calculated value must carry metadata: source document ID, form line number, IRS publication section or NJ tax code section. Implement this as a `TaxLineItem` type with trace fields.

### CONFIGURATION OVER HARDCODING
Tax brackets, standard deduction amounts, credit limits, phase-out thresholds MUST be in configuration files under `src/config/tax-year/2025/`. No tax amounts may appear as literals in calculation code.

### PII PROTECTION
- Social Security Numbers must never appear in logs, console output, or /data/ test outputs
- Use masked SSN format (XXX-XX-1234) in all non-encrypted contexts
- Document storage paths must not include PII
- The /data/ directory must NEVER contain real user data — only synthetic test data

## Architecture Rules

### MODULAR SLICE ARCHITECTURE
Four independent modules under `src/modules/`:
- `document-extraction/` — OCR, field mapping, confidence scoring
- `tax-engine/` — All tax calculations (federal + NJ state)
- `forms-generation/` — PDF rendering of completed forms
- `user-flow/` — Wizard steps, progress, UI orchestration

Modules communicate through typed interfaces defined in `src/lib/types.ts`. No direct imports between module internals.

### DATABASE INTERFACE PATTERN
All DB access through `src/lib/db/interface.ts`. Two implementations:
- `src/lib/db/json.ts` — JSON flat-file (DATABASE=json)
- `src/lib/db/prisma.ts` — PostgreSQL (DATABASE=prisma)
Factory: `src/lib/db/index.ts` exports `getDatabase()`.

### STATE MANAGEMENT
- Zustand for client-side UI state (wizard progress, form selections)
- Server-side for all tax calculations (never calculate taxes client-side)
- API routes under `src/app/api/` for calculation requests

## Technology Constraints

- **OCR**: Tesseract.js (client-side) with server-side fallback via sharp + tesseract
- **PDF Generation**: @react-pdf/renderer (React component-based layout for form fidelity)
- **Tax Calculations**: Pure TypeScript functions — no external tax library
- **UI Components**: shadcn/ui with design tokens, interface-craft animation patterns
- **Framework**: Next.js 14 with TypeScript strict mode
- **Runtime**: Node.js 20+

## Refactor Cadence

After every 2 task files completed, review for:. File line counts exceeding 250 lines (split before hitting 300)
2. Duplicate type definitions (consolidate to central types)
3. Unused imports or dead code
4. Opportunities to reduce total line count

## Testing Requirements

- Integration tests output pipeline data to `/data/` as JSON
- Test cases use synthetic data only (no real PII)
- Every tax calculation module has at least one integration test with a known-answer test case
- IRS-published examples must be used as test vectors where available

## Disclaimers

The app must include at all entry points:
"TaxFile is a self-preparation tool, not professional tax advice. Results should be reviewed by a qualified tax professional before filing."
