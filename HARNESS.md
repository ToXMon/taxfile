# Development Harness

Based on 0xSero's Agentic Coding 101 methodology. This document defines all standards, patterns, and workflows that agent subordinates must follow when working in this repository.

## Sub-Agent Profiles and Behavioral Rules

### Engineering Agents (developer, hacker)
- Enforce modular slice architecture: configs in dedicated files, domain isolation, no cross-module leakage
- TypeScript strict mode: no any types, centralized types in src/lib/types.ts, use unknown + explicit cast
- LSP rules: 300 lines per file (ERROR), 20 files per directory (ERROR), no unused imports
- Database interface pattern: all DB access through typed interface, JSON mock for dev, Prisma for production
- AGENTS.md: check/create before modifying any module
- Autonomy: no questions mid-task, no stop on non-blocking errors (log to /data/errors.json), self-decide on ambiguity

### Tax-Specific Rules
- Never guess a tax calculation — flag with TaxCalculationFlag type (source publication section, reason)
- All tax amounts (brackets, deductions, credits, phase-outs) in src/config/tax-year/2025/
- No tax literals in calculation code
- Every calculated value carries TaxLineItem metadata: source document ID, form line, IRS pub section
- Traceability: document → form line → IRS publication section / NJ tax code section

### PII Protection
- SSNs never in logs, console output, or /data/ test outputs
- Masked SSN format (XXX-XX-1234) in all non-encrypted contexts
- Document storage paths must not include PII
- /data/ contains only synthetic test data — never real user data

### QA Agent (test-engineer)
- Verify integration test coverage for every tax calculation module
- Validate /data output JSON against acceptance criteria in scope.md
- Enforce no any types, no type divergence across modules
- IRS-published examples must be used as test vectors where available

## AGENTS.md Hierarchy Standard

- Root: repo overview, tech stack, module map, global standards
- Per module: purpose, how it works, module-specific standards, type contracts, dependencies
- Models auto-load nearest AGENTS.md when operating in that directory
- Never stale — update after every module modification

## Database Interface Pattern

All DB access through src/lib/db/interface.ts (DatabaseInterface).
Two implementations:
- src/lib/db/json.ts — JSON flat-file, activated with DATABASE=json
- src/lib/db/prisma.ts — Prisma/PostgreSQL, activated with DATABASE=prisma
Factory: src/lib/db/index.ts exports getDatabase() that reads DATABASE env var.

## Refactor Cadence (50/50 Rule)

After every 2 task files completed, review for:
1. File line counts exceeding 250 lines (split before hitting 300)
2. Duplicate type definitions (consolidate to central types)
3. Unused imports or dead code
4. Opportunities to reduce total line count

## State Diagram Protocol

After major changes, generate Mermaid or ASCII state machine diagram.
Output to docs/state/ with timestamp.
Covers: database structure, pipeline flows, module state transitions, user flows.

## Integration Test + /data Pipeline Standard

- Every tax calculation module has at least one integration test with a known-answer test case
- Tests simulate: data in → processing → data out
- Each pipeline step outputs structured JSON to /data/
- Verify correctness by reading /data output, not raw source code
- Test cases use synthetic data only (no real PII)

## File Structure

AGENTS.md                    — Top-level repo documentation
HARNESS.md                   — This file
src/lib/types.ts             — Centralized type definitions
src/lib/db/interface.ts      — Database interface contract
src/lib/db/json.ts           — JSON flat-file DB implementation
src/lib/db/prisma.ts         — Prisma production DB implementation
src/lib/db/index.ts          — Database factory
src/config/tax-year/2025/    — 2025 tax parameters
src/modules/                 — Four independent modules
data/                        — Pipeline test output directory (gitignored)
data/.gitkeep                — Placeholder
docs/state/                  — State machine diagrams archive
docs/state/.gitkeep          — Placeholder
