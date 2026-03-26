# NJ Forms Generation Submodule
## Purpose
PDF rendering components for NJ state tax forms using @react-pdf/renderer.
## Conventions
- All components accept FormLineMap + taxYear props
- Use federal/helpers.tsx shared styles (import from ../federal/helpers)
- Inline styles only for react-pdf Style compatibility
- Max 300 lines per file
- No `any` types
## Files
- nj-1040.tsx: NJ-1040 main form
- schedule-a-b-c.tsx: NJ Schedules A, B, C
