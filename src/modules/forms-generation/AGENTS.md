# Forms Generation Module

## Purpose
Renders completed tax forms as PDFs using @react-pdf/renderer.
Takes CompleteTaxReturn from the tax engine and produces downloadable PDF buffers
for federal (Form 1040 + schedules) and NJ state (NJ-1040 + schedules).

## How It Works
Each form is a React component using @react-pdf/renderer primitives (Document, Page, View, Text).
Form components receive FormLineMap data and render values into the correct box positions.
The module provides a generatePDF() function that renders a Document to a Uint8Array buffer.

## Type Contracts
- **Inputs**: CompleteTaxReturn from @/lib/types (contains FederalForms + NJForms with FormLineMap data)
- **Outputs**: Uint8Array (PDF buffer) per form or combined return PDF

## Standards
- No `any` types — use `unknown` + cast if needed
- Each form component in its own file under forms/ subdirectory
- File limit: 300 lines. Directory limit: 20 files.
- Form fidelity: values placed in correct box positions matching IRS/NJ form layouts
- PII protection: SSNs displayed as XXX-XX-1234 in PDFs
- Disclaimer text required on every generated PDF

## PDF Rendering Approach
- @react-pdf/renderer: React component-based PDF generation
- Each form = one <Document> with one or more <Page> elements
- Absolute positioning within <View> containers for box-level placement
- Monospace fonts for numeric fields, sans-serif for labels
- Page size: US Letter (8.5" × 11") per IRS standards

## Dependencies
- `@react-pdf/renderer` — PDF generation (React component-based)
- `@/lib/types` — CompleteTaxReturn, FederalForms, NJForms, FormLineMap, TaxLineItem
- No direct imports from tax-engine/ (receives CompleteTaxReturn as input)

## Form Fidelity Notes
- IRS forms have specific box sizes and positions — approximate with flexbox/grid where exact positioning is impractical
- NJ forms follow similar layout principles
- Color: black text on white background, gray lines for form borders
- Each PDF includes: form title, tax year, taxpayer name (no SSN full), disclaimer footer

## Disclaimer
Every generated PDF must include:
"TaxFile is a self-preparation tool, not professional tax advice. Results should be reviewed by a qualified tax professional before filing."
