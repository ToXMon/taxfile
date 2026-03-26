# User Flow Module
## Purpose
Client-side wizard components and state management for the tax preparation flow.
## Conventions
- Wizard steps: UPLOAD -> REVIEW -> QUESTIONS -> SUMMARY -> FORMS
- All state managed via Zustand store at src/stores/tax-return-store.ts
- Components are React client components ('use client')
- Max 300 lines per file
- No `any` types
## Files
- upload-wizard-step.tsx: Document upload UI
- review-step.tsx: Review extracted data
- questions-step.tsx: Additional questions
- tax-summary-step.tsx: Tax summary dashboard
- forms-viewer-step.tsx: Forms viewer + download
- wizard-progress.tsx: Progress bar + navigation
- error-highlight.tsx: Error highlighting + missing doc detection
