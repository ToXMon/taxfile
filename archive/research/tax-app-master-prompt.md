# Tax App — Master Build Prompt

Copy everything below this line and paste it as your message to Agent Zero.

---

Build me a full-stack tax preparation application called **TaxFile** that produces the same output a tax professional would generate for IRS e-filing. This is a serious financial tool — accuracy is non-negotiable.

## My Tax Situation (Reference Context)
- Filing status: Married Filing Jointly (MFJ) — first year filing jointly
- Location: New Jersey (state return required)
- Dependent: 1 child (qualifying child for Child Tax Credit)
- This is my reference scenario — the app must handle this case perfectly, but be built to handle ALL common filing scenarios

## Product Vision
A web application where users upload tax documents (W-2s, 1099s, 1098s, etc.), the app extracts data via OCR/AI, maps it to the correct IRS forms, calculates federal and NJ state taxes, applies all eligible deductions and credits, and produces a complete tax return ready for e-filing.

## Core Requirements

### Document Upload & Extraction
- Upload PDF/images of: W-2, 1099-INT, 1099-DIV, 1099-B, 1099-MISC, 1099-NEC, 1098 (mortgage interest), 1098-T (tuition), 1098-E (student loan interest), 1095-A/B/C (health coverage)
- AI-powered extraction using OCR to pull: payer name, EIN, amounts, box-by-box data
- User review/edit step after extraction — no blind trust on extracted data
- Support for multi-page documents and multiple documents of the same type

### Tax Calculation Engine
- **Federal**: Form 1040, Schedule 1 (Additional Income), Schedule 2 (Additional Taxes), Schedule 3 (Additional Credits), Schedule A (Itemized Deductions), Schedule B (Interest & Dividends), Schedule D (Capital Gains), Schedule 8812 (Credits for Qualifying Children)
- **New Jersey**: NJ-1040, Schedule A (Deductions), Schedule B (Interest/Dividends), Schedule C (Business Income if applicable)
- **Deductions logic**: Automatically compare Standard vs Itemized, recommend the better option
- **Credits logic**: Child Tax Credit ($2,000/child, phase-out rules), Child and Dependent Care Credit, Earned Income Credit, NJ Property Tax Deduction ($1,000 max or actual), NJ Earned Income Tax Credit, American Opportunity Credit, Lifetime Learning Credit
- **Tax bracket calculation**: Apply correct marginal rates for MFJ brackets (2025 tax year)
- **NJ-specific**: NJ has its own bracket structure (1.4% to 10.75% for MFJ), no standard deduction (use federal standard or itemized), property tax deduction vs credit election

### Output & Filing
- Generate completed IRS forms as fillable PDFs matching the official layout
- Generate NJ state forms as fillable PDFs
- Show a tax summary dashboard: total income, adjustments, deductions, taxable income, federal tax, state tax, total tax, payments, refund/owed
- Export tax data as JSON for record-keeping
- Audit trail: show exactly how each number on each form was calculated (source document → line item)

### User Experience
- Step-by-step wizard: Upload → Review Extracted Data → Answer Additional Questions → Review Return → File
- Progress indicator showing completion percentage
- Inline explanations for every tax question (tooltips explaining WHY we're asking)
- Error highlighting: flag missing documents, inconsistencies, potential audit triggers
- Mobile-responsive (many users will upload from phone camera)

## Technical Architecture Requirements

Follow the Development Harness standards defined in HARNESS.md:
- Next.js 14 with TypeScript strict mode (no `any` types)
- Modular slice architecture: /src/modules/tax-engine, /src/modules/document-extraction, /src/modules/forms-generation, /src/modules/user-flow
- Database interface pattern with JSON mock for development (DATABASE=json) and Prisma/PostgreSQL for production
- 300-line file limit, 20-file directory limit
- AGENTS.md in every module directory
- shadcn/ui for all components with design tokens
- All integration tests output pipeline data to /data/ as JSON

### Key Technical Decisions (pre-made)
- **OCR**: Use Tesseract.js for client-side OCR, with a fallback server-side option using sharp + tesseract
- **PDF Generation**: Use @react-pdf/renderer for form generation (not pdf-lib — we need React component-based layout for form fidelity)
- **Tax Calculations**: Pure TypeScript functions — no external tax library (they're outdated). Build our own calculation modules from IRS publications and NJ Division of Taxation docs
- **State Management**: Zustand for client state, server-side for sensitive calculations
- **Document Storage**: Local for dev (JSON DB), S3-compatible for production (user-uploaded docs are PII — encrypt at rest)

## Department Delegation Guide

When the executive-producer decomposes this, here's the suggested department breakdown:

**Product Manager**: Write the PRD with all IRS form mappings, NJ-specific rules, user stories for each wizard step, acceptance criteria per form line
**UX Researcher**: Research TurboTax/H&R Block flows, identify pain points, design the wizard step sequence
**UI Designer**: Design the upload flow, document review cards, form preview, summary dashboard using shadcn/ui with interface-craft animation patterns
**Backend Architect**: Design the tax calculation engine architecture — form modules, calculation pipeline, deduction/credit resolution system
**AI Engineer**: Build the document extraction pipeline — OCR integration, field mapping per form type, confidence scoring, human review trigger
**DevOps Automator**: Set up CI/CD, environment switching (json vs postgres), document encryption, S3 storage config
**Test Engineer**: Build integration tests that verify tax calculations against known test cases (IRS published examples + NJ examples)
**Documentation Lead**: Create AGENTS.md for each module, generate state diagrams for the tax calculation pipeline, document the form mapping reference

## Workpack Generation

This is a multi-session project (estimated 40-60 hours). Generate a Workpack with:
- rules.md: Include all harness autonomy rules plus tax-specific rule — "Never guess a tax calculation. If the IRS publication or NJ tax code is ambiguous, flag it for human review rather than estimating."
- scope.md: Full product specification with form-by-form breakdown
- task_0001 through task_NNN: Sequential tasks ordered by dependency

## Non-Negotiable Constraints

1. **Tax accuracy is paramount** — every calculation must be traceable to a specific IRS publication section or NJ tax code section. No approximations.
2. **PII protection** — social security numbers, income data, and documents must be encrypted. Never log PII. The /data/ directory must NEVER contain real user data.
3. **Not legal advice** — the app must include disclaimers that it is a self-preparation tool, not professional tax advice. Include a "review by a tax professional" recommendation.
4. **2025 tax year** — use 2025 IRS brackets, standard deduction amounts ($29,200 MFJ), NJ rates and thresholds
5. **No hardcoded values** — tax brackets, deduction amounts, credit limits must be in a configuration file that can be updated for future tax years without code changes

## Success Criteria
- I can upload my W-2, 1099-INT, and 1098 documents and get a completed 1040 + NJ-1040
- The calculated numbers match what I'd get from a tax professional for my MFJ+child scenario
- Every number on every form has an audit trail showing its source
- The app handles at minimum: W-2 income, interest income, dividend income, mortgage interest deduction, child tax credit, NJ property tax deduction
- All harness standards are followed (AGENTS.md, file limits, type strictness, integration tests with /data output)