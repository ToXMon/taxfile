# TaxFile Engineering Audit Report
**Date**: 2026-03-26
**Auditor**: Engineering Department
**Scope**: Full codebase at `/a0/usr/workdir/taxfile/src/`
**Basis**: Source code inspection, npm audit, static analysis

---

## Executive Summary

TaxFile demonstrates **strong architectural discipline** — HARNESS.md LSP rules are fully met (no file over 300 lines, no directory over 20 files), zero `any` types, TypeScript strict mode enabled, centralized type system, and a clean DB interface pattern. The modular structure (4 modules) is well-defined with clear boundaries.

**However, the application cannot function in production today.** Three runtime-crashing bugs were discovered, the CRUD API bypasses the database layer entirely, and the CI/CD pipeline has zero quality gates. The security posture (per the separate audit) combined with these engineering findings means this is a **prototype, not a product**.

**Verdict**: Ship-blocking bugs must be fixed before any user-facing deployment. Estimated **3–4 weeks** of focused engineering work to reach beta quality.

---

## 1. Architecture Assessment

### Strengths
- **Module boundaries are clean**: document-extraction, tax-engine, forms-generation, user-flow have zero cross-import leakage
- **DB Interface Pattern**: `DatabaseInterface` contract in `interface.ts` is minimal and correct (4 methods). Factory in `index.ts` reads `DATABASE` env var.
- **Type centralization**: All types in `src/lib/types.ts` — no duplicate type definitions across modules
- **Config isolation**: Tax parameters fully externalized to `src/config/tax-year/2025/`
- **AGENTS.md per module**: Present in forms-generation (root + nj/), tax-engine would benefit from same

### Critical Issues

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| ARCH-1 | **CRUD API bypasses DatabaseInterface** — `/api/documents/route.ts` uses `Map<string, ExtractedDocument>` in module scope. Data is lost on server restart, never persisted to JSON files, completely ignores the db/ abstraction. | CRITICAL | `src/app/api/documents/route.ts:12` |
| ARCH-2 | **prisma.ts doesn't exist** — HARNESS.md and db/index.ts reference it, but only json.ts is implemented. Factory throws on `DATABASE=prisma`. | HIGH | `src/lib/db/` |
| ARCH-3 | **Duplicate WizardStep enum** — `types.ts` defines `WizardStep` with lowercase values (`'upload'`), `store.ts` defines a separate `WizardStep` with uppercase values (`'UPLOAD'`). Different enum members, potential silent mismatch bugs. | HIGH | `src/lib/types.ts:108`, `src/stores/tax-return-store.ts:14` |

### Moderate Issues

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| ARCH-4 | Zod validation schemas duplicated inline in `/api/calculate/route.ts` and `/api/forms/route.ts` — the `taxLineItemSchema` and full request schemas are copy-pasted, not shared. DRY violation, divergence risk. | MEDIUM | API routes |
| ARCH-5 | `as never` type escape hatch in orchestrator.ts for non-itemized Schedule A branch — masks type errors instead of providing a proper empty FormLineMap. | MEDIUM | `src/modules/tax-engine/orchestrator.ts:77` |
| ARCH-6 | No AGENTS.md in tax-engine, document-extraction, or user-flow modules (only forms-generation has them) | LOW | Module roots |

---

## 2. Code Quality

### Strengths
- **Zero `any` types** across entire codebase (verified via grep)
- **ESLint enforced**: `@typescript-eslint/no-explicit-any: error`, `max-lines: 300`
- **TypeScript strict: true** in tsconfig.json
- **Consistent error handling pattern**: All API routes use try/catch with `err instanceof Error` checks
- **Clean separation**: UI components never import from tax-engine, mappers never import from store

### Critical Issues

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| CQ-1 | **`fedPayments` undefined variable** — orchestrator.ts line 189 uses `fedPayments` which is never declared or computed. This causes a `ReferenceError` at runtime. The entire tax calculation pipeline crashes. Federal withholding from W-2s is extracted by the mapper (`federalTax` field) but never aggregated in the orchestrator. | CRITICAL | `src/modules/tax-engine/orchestrator.ts:189` |
| CQ-2 | **`localStorage` in server-side module** — `pipeline.ts` `logError()` function calls `localStorage.getItem/setItem`. This module is imported by `/api/documents/extract/route.ts` which runs in Node.js. `localStorage` is browser-only — this throws `ReferenceError` at runtime. | CRITICAL | `src/modules/document-extraction/pipeline.ts:46-52` |

### Moderate Issues

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| CQ-3 | 38 unused variable lint errors — all in `tax-return-store.ts` Zustand `set()` callback parameters (e.g., `(step)`, `(info)`, `(doc)`). These are functionally harmless (Zustand pattern) but violate the project's own no-unused-vars rule and indicate the store could use `_` prefix convention or destructuring. | LOW | `src/stores/tax-return-store.ts` |
| CQ-4 | Step 19 comment missing in orchestrator.ts — jumps from step 18 (NJ Sch A) to step 20 (NJ-1040 core). Suggests deleted code or missing NJ Schedule B pipeline step. | LOW | `src/modules/tax-engine/orchestrator.ts:87-91` |

### Code Metrics
```
Total source files:     ~65 (.ts + .tsx)
Total lines:            9,400
Largest file:           277 lines (validation.ts) — well under 300 limit
Largest directory:      15 files (components/ui) — well under 20 limit
Average file size:      ~145 lines
```

---

## 3. Scalability Analysis

### 2 Users (Husband + Wife)
**Status: WILL NOT WORK**
- The in-memory Map in `/api/documents` means if one user uploads documents, the other user's API calls go to the same Map. No per-session or per-return isolation at the API layer.
- JSON flat-file DB has no concurrency handling — simultaneous writes to the same return ID could corrupt data.
- No auth = no way to distinguish users.

### 10 Users
**Status: BROKEN**
- `listReturns()` in json.ts reads ALL JSON files sequentially with `for` loop — O(n) file I/O per request. With 10 users each having 1-2 returns, this is manageable but slow.
- @react-pdf/renderer PDF generation is CPU-intensive. Multiple simultaneous `/api/forms` requests could exhaust CPU on a single Akash node.
- No rate limiting — a single user could flood OCR endpoints.

### 100 Users
**Status: BROKEN**
- JSON flat-file DB: `listReturns()` doing 100+ sequential `fs.readFile` calls per request = seconds of latency.
- No connection pooling (not applicable to JSON, but no request queuing either).
- Tesseract.js OCR is extremely CPU-intensive — client-side helps but server-side fallback would be crushed.
- Single-node Akash deployment = no horizontal scaling.
- 5GiB persistent volume would fill with document data.

### What Breaks First
1. **In-memory Map** — data loss on any server restart (already broken)
2. **No auth** — can't isolate users (already broken)
3. **JSON listReturns()** — O(n) file reads under concurrent load
4. **PDF generation** — CPU-bound, no queuing
5. **OCR** — CPU-bound, no job queue

---

## 4. Production Readiness Gap

### Must-Have Before Any User (Blocking)

| Item | Effort | Notes |
|------|--------|-------|
| Fix fedPayments crash | S | Add federal withholding aggregation from W-2 documents |
| Fix localStorage crash | S | Replace with server-side error logging (fs or console) |
| Fix duplicate WizardStep | S | Delete enum from store.ts, import from types.ts |
| Wire CRUD API to DatabaseInterface | M | Replace Map with getDatabase() calls |
| Add authentication | L | NextAuth.js or similar — blocks multi-user |
| Add security headers | S | next.config.mjs headers or middleware |
| Fix path traversal in json.ts | S | Validate/sanitize `id` parameter |
| Add rate limiting | M | Middleware or API route wrapper |

### Must-Have Before Beta

| Item | Effort | Notes |
|------|--------|-------|
| Prisma migration | L | Schema, migrations, seed data, swap factory |
| PostgreSQL on Akash | M | Separate service or managed DB |
| Monitoring/logging | M | Structured logging, health endpoints |
| Error tracking | S | Sentry or similar |
| TLS termination | S | Akash SDL ingress config |
| Session management | M | Secure cookie-based sessions |
| CSRF protection | S | Double-submit cookie or token |
| Input sanitization | M | Beyond Zod — XSS in rendered fields |
| Encryption at rest | M | AES-256 for SSNs in DB |

### Nice-to-Have for V1

| Item | Effort | Notes |
|------|--------|-------|
| Docker HEALTHCHECK | S | Add to Dockerfile |
| Base image pinning | S | Digest pins in Dockerfile |
| CI test/lint gates | M | Add to GitHub Actions |
| Dependency scanning | S | Dependabot or Snyk |
| Docker hardening | M | Distroless or chainguard base |

---

## 5. Technical Debt Backlog

### Priority 1 — Ship Blockers

| ID | Debt Item | Size | Description |
|----|-----------|------|-------------|
| TD-1 | fedPayments undefined | S | Orchestrator crashes on every calculation |
| TD-2 | localStorage in server module | S | Pipeline.ts crashes in Node.js |
| TD-3 | Duplicate WizardStep enum | S | Conflicting enum definitions |
| TD-4 | CRUD API not using DB layer | M | In-memory Map bypasses persistence |
| TD-5 | Path traversal in json.ts | S | Unsanitized `id` in filePath() |

### Priority 2 — Architectural

| ID | Debt Item | Size | Description |
|----|-----------|------|-------------|
| TD-6 | Prisma implementation missing | L | prisma.ts doesn't exist, factory throws |
| TD-7 | Zod schema duplication | M | Shared schemas needed for calculate + forms routes |
| TD-8 | Missing AGENTS.md files | S | 3 of 4 modules lack module docs |
| TD-9 | `as never` type escape | S | Proper empty FormLineMap type needed |
| TD-10 | Missing step 19 in orchestrator | S | Comment numbering gap, possible missing NJ Sch B step |

### Priority 3 — Code Hygiene

| ID | Debt Item | Size | Description |
|----|-----------|------|-------------|
| TD-11 | 38 unused variable lint errors | S | Zustand callback params need `_` prefix |
| TD-12 | No shared API validation layer | M | Extract Zod schemas to shared module |
| TD-13 | Error logging inconsistency | S | Some routes use console, pipeline uses localStorage |

### Priority 4 — Future

| ID | Debt Item | Size | Description |
|----|-----------|------|-------------|
| TD-14 | No PDF form validation | M | Generated PDFs aren't validated against IRS specs |
| TD-15 | No tax year abstraction | M | Hardcoded to 2025, no mechanism for multi-year |
| TD-16 | Client-side OCR data exposure | M | Full document text in browser memory |

**Effort Legend**: S = < 4 hours, M = 4–16 hours, L = 16–40 hours

---

## 6. Dependency Health

### Production Dependencies

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| next | 14.2.35 | HIGH vuln | HTTP request smuggling (GHSA-ggv3), unbounded disk cache (GHSA-3x4c). Fix requires Next.js 16 (breaking). |
| @react-pdf/renderer | ^4.3.2 | OK | Stable, no known vulns |
| tesseract.js | ^7.0.0 | CAUTION | v7 is recent — verify stability, no known vulns |
| zod | ^4.3.6 | CAUTION | v4 is very recent (major rewrite from v3). API differences from v3 docs may confuse contributors. |
| zustand | ^5.0.12 | OK | Stable v5 |
| sharp | ^0.34.5 | OK | Active maintenance |
| canvas | ^3.2.2 | OK | Native dep, builds in Docker |
| jszip | ^3.10.1 | OK | Mature |
| pdfjs-dist | ^5.5.207 | OK | Active |

### Dev Dependencies

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| eslint | ^8 | MODERATE | minimatch/brace-expansion vulns (dev-only, not shipped) |
| typescript | ^5 | OK | |

### Lock File Integrity
- `npm ci --dry-run` passes — lock file is consistent
- 651 packages total

### Missing Dependencies
- **No test runner** (jest, vitest, or @testing-library)
- **No security packages** (helmet, csrf, rate-limiter)
- **No auth package** (next-auth, lucia)
- **No logging package** (pino, winston)

### Supply Chain Risk
- No `npm audit` in CI pipeline
- No Dependabot or Renovate configuration
- No lockfile integrity check in CI

---

## 7. Testing Gaps

### Current State

| Aspect | Status | Details |
|--------|--------|---------|
| Test runner | NONE | No jest/vitest configured |
| Test execution | MANUAL | Tests are standalone .ts scripts with ESM imports |
| Unit tests | NONE | No isolated unit tests for any module |
| Integration tests | PARTIAL | 6 test scripts exist, 5 have output results |
| E2E tests | NONE | No Playwright/Cypress |
| Coverage measurement | NONE | No coverage tooling |

### Existing Test Scripts (data/tests/)

| Test File | Runs? | Result | Coverage |
|-----------|-------|--------|----------|
| federal-calc-test.ts | NO (ESM) | Pass | Federal 1040, Sch 8812 values match expected |
| nj-calc-test.ts | NO (ESM) | Pass | NJ-1040 values match expected |
| extraction-test.ts | NO (ESM) | Pass | OCR extraction pipeline |
| full-pipeline-test.ts | NO (ESM) | Pass | End-to-end scenario |
| audit-trail-test.ts | NO (ESM) | Pass | Audit trail entries present |

**Note**: These tests CANNOT run. They use `import.meta.url` (ESM) but there's no configured ESM runner. Running `node data/tests/federal-calc-test.ts` fails. They were likely executed during development with `tsx` but aren't integrated into any workflow.

### Test Results Quality
- Federal calc test: totalIncome=95850, AGI=95850, deductions=29200, taxableIncome=66650 — **matches expected values**
- This validates the tax engine logic is correct for the reference scenario (MFJ + 1 child, W-2 $95k + 1099-INT $850)
- **But**: The fedPayments bug means the `totalPayments` and `refundOrOwed` fields in the summary would be wrong — the test doesn't appear to validate those fields

### Critical Missing Tests

| Area | Priority | Notes |
|------|----------|-------|
| orchestrator.ts summary calculations | CRITICAL | totalPayments/refundOrOwed never validated — fedPayments bug would be caught here |
| CRUD API persistence | CRITICAL | In-memory Map means no persistence test would pass |
| Path traversal in json.ts | HIGH | Security test: id=`../../etc/passwd` |
| Document type detection edge cases | HIGH | Unknown document types, low-confidence detection |
| Schedule A itemized vs standard | MEDIUM | Both branches need validation |
| NJ property tax election | MEDIUM | Credit vs deduction toggle |
| Form PDF field mapping | MEDIUM | Verify PDF output contains correct values |
| Wizard step navigation | LOW | UI flow validation |

---

## 8. Deployment Pipeline

### Current CI/CD (.github/workflows/docker-publish.yml)

```
on: push to main
-> Checkout
-> Docker Buildx
-> Login to GHCR
-> Build and push (SHA + branch tags)
-> Cache: GitHub Actions cache
```

### Strengths
- Multi-stage Docker build (deps -> build -> runner)
- Non-root user in final stage (`nextjs:nodejs`)
- GHA cache for Docker layers
- SHA-tagged images for traceability
- `npm ci` for deterministic installs
- Standalone output mode for minimal image

### Missing

| Item | Severity | Notes |
|------|----------|-------|
| No lint step | HIGH | `npm run lint` never runs in CI |
| No test step | HIGH | No test execution in CI |
| No build verification | MEDIUM | `npm run build` runs inside Docker but failures don't block pipeline separately |
| No security scanning | HIGH | No `npm audit`, no Trivy, no Snyk |
| No rollback mechanism | MEDIUM | Only SHA tags — no semver, no easy rollback |
| No deployment trigger | MEDIUM | Manual Akash deploy after CI push |
| No HEALTHCHECK in Dockerfile | MEDIUM | Akash can't detect unhealthy containers |
| Base images not pinned | LOW | `node:20-slim` could change silently |

### Docker Image Analysis

| Aspect | Status | Notes |
|--------|--------|-------|
| Multi-stage | YES | 3 stages: deps, builder, runner |
| Non-root | YES | `USER nextjs` (uid 1001) |
| Minimal base | YES | `node:20-slim` |
| Apt cleanup | YES | `rm -rf /var/lib/apt/lists/*` |
| HEALTHCHECK | NO | Missing — add `HEALTHCHECK CMD curl -f http://localhost:3000/api/health` |
| Distroless | NO | Could use `gcr.io/distroless/nodejs20` for runner stage |
| .dockerignore | YES | Excludes node_modules, .next, tests, docs |
| Data volume | YES | `/app/data` created and owned by nextjs user |

### Recommended CI/CD Pipeline

```yaml
on: push to main
-> Checkout
-> Setup Node.js 20
-> npm ci
-> npm run lint          # NEW: fail on lint errors
-> npm run test          # NEW: fail on test failures
-> npm audit --omit=dev  # NEW: fail on HIGH+ vulns
-> Docker Buildx
-> Trivy scan image     # NEW: container vulnerability scan
-> Build and push
-> Notify deployment    # NEW: trigger Akash deploy
```

---

## Summary: Release Readiness Matrix

| Dimension | Grade | Summary |
|-----------|-------|---------|
| Architecture | B+ | Clean module boundaries, DB interface pattern good, but CRUD bypasses it |
| Code Quality | B | No `any`, strict TS, under size limits, but 3 runtime crashes |
| Scalability | F | In-memory Map, no auth, no concurrency, single-node only |
| Production Readiness | F | Crashing bugs, no auth, no encryption, no monitoring |
| Tech Debt | C | 16 items identified, 5 are ship-blockers (3 are S-sized) |
| Dependency Health | C | Next.js HIGH vuln, Zod v4 risk, no test/security deps |
| Testing | F | No test runner, tests can't execute, no coverage |
| Deployment Pipeline | D | Good Docker build, but zero quality gates in CI |

**Overall Grade: D+** — Strong architectural foundation severely undermined by runtime crashes, missing persistence in the CRUD layer, and zero automated quality gates.

---

## Recommended Fix Order (Sprint Plan)

### Sprint 1: Stop the Bleeding (3 days)
1. Fix `fedPayments` — aggregate W-2 federal withholding in orchestrator
2. Fix `localStorage` — replace with `console.error` or fs-based logging
3. Fix duplicate `WizardStep` — delete from store.ts, import from types.ts
4. Fix path traversal — validate `id` matches `/^[a-zA-Z0-9-]+$/`
5. Wire CRUD API to `getDatabase()` — replace Map with JSON DB calls
6. Add `/api/health` endpoint

### Sprint 2: Quality Gates (3 days)
7. Install vitest, configure, make existing test scripts runnable
8. Add orchestrator summary validation test (catches fedPayments-class bugs)
9. Add `npm run lint` and `npm run test` to CI pipeline
10. Add `npm audit` to CI pipeline
11. Extract shared Zod schemas to `src/lib/validation.ts`
12. Fix 38 unused variable lint errors

### Sprint 3: Security Foundation (5 days)
13. Add NextAuth.js with credential provider
14. Add security headers via next.config.mjs
15. Add CSRF protection (double-submit cookie)
16. Add rate limiting middleware
17. Add PII encryption at rest (AES-256 for SSN fields)
18. Remove PII from Zustand persist (exclude taxpayer from partialize)

### Sprint 4: Production DB (5 days)
19. Design Prisma schema from TaxReturnRecord type
20. Implement prisma.ts DatabaseInterface
21. Set up PostgreSQL on Akash or external provider
22. Data migration script (JSON -> PostgreSQL)
23. Integration tests against real DB

### Sprint 5: Observability (3 days)
24. Structured logging (pino)
25. Health check endpoint with DB connectivity test
26. Docker HEALTHCHECK directive
27. Error tracking (Sentry or equivalent)
28. Base image pinning to digests

---

*End of Audit Report*
