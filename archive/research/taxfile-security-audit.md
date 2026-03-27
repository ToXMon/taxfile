# TaxFile Security Audit Report

**Audit Date:** 2026-03-26  
**Auditor:** Security Department — Penetration Testing Division  
**Scope:** Full-stack source code review of TaxFile v0.1.0 (Next.js 14)  
**Classification:** CONFIDENTIAL — Internal Use Only  

---

## Executive Summary

TaxFile in its current state is **not suitable for release as a product handling real taxpayer data**. The audit identified **6 Critical**, **9 High**, **9 Medium**, and **5 Low** severity findings. The most severe issues — path traversal in the database layer, zero authentication, no encryption at rest, and absent security headers — each individually represent a disqualifying deficiency for a tax preparation application. The application lacks every fundamental security control required for handling PII under IRS Publication 1345 (e-file requirements) and NJ data protection statutes.

**Recommendation:** Do not deploy to production until at minimum all Critical and High findings are remediated.

---

## 1. PII Data Flow Analysis

### 1.1 SSN Flow: Upload → Extraction → Storage → PDF Output

```
[User uploads W-2 PDF]
       ↓
[Browser: pdfjs-dist renders PDF to canvas → canvas.toDataURL() → Tesseract.js OCR]
       ↓  ← FULL SSN EXISTS HERE in OCR fullText string (in browser memory)
[w2-mapper.ts: extractSSN() matches SSN via regex /\b(\d{3})[ -]?(\d{2})[ -]?(\d{4})\b/]
       ↓  ← Only last 4 digits retained: maskSSN() → "XXX-XX-1234"
[ExtractedDocument.fields.employeeSSN.label = "Employee SSN (masked)"]
       ↓  ← Masked SSN sent to /api/documents/extract response
[Client: addDocument() stores in Zustand store]
       ↓  ← PERSISTED to localStorage key "tax-return-store" (unencrypted)
[POST /api/calculate with ssnMasked field]
       ↓
[POST /api/forms → assembleForms() → Form1040Document ssnMasked={taxpayer.ssnMasked}]
       ↓
[PDF renders: "SSN: XXX-XX-1234"]  ← INCOMPLETE: IRS requires full SSN on e-file forms
```

### 1.2 Leakage Points Identified

| # | Point | Data at Risk | Finding ID |
|---|-------|-------------|------------|
| L1 | Browser memory during OCR | Full SSN in `ocrResult.fullText` | M-03 |
| L2 | Zustand localStorage persistence | Masked SSN, name, address, dependents, all extracted financial data | C-04 |
| L3 | API response from /api/documents/extract | Masked SSN, EIN, all financial fields | H-10 |
| L4 | JSON DB files on Akash persistent volume | Full TaxReturnRecord including masked SSNs, all financial data, unencrypted | C-03 |
| L5 | localStorage error log (`taxfile_errors`) | File names, error context | M-05 |

### 1.3 Critical Design Gap: Full SSN Never Stored

The application architecture has a fundamental contradiction: the type system uses `ssnMasked: string` throughout, meaning **the full SSN is never captured, stored, or transmitted**. The OCR extracts it and immediately discards all but the last 4 digits. There is **no UI input field** for users to enter or verify their full SSN. The generated PDFs contain only masked SSNs (`XXX-XX-1234`), making them **IRS e-file incompatible** — Form 1040 requires the full SSN. This means the app cannot fulfill its stated purpose of producing "e-file-ready" returns.

---

## 2. Attack Surface Assessment

### 2.1 API Endpoint Inventory

| Endpoint | Method | Auth | Rate Limit | Input Validation | Finding |
|----------|--------|------|------------|------------------|---------|
| `/api/documents/extract` | POST | None | None | Zod (documentType only) | C-02, H-08, H-09 |
| `/api/extract` | POST | None | None | None | H-08, H-09, H-11 |
| `/api/documents` | GET | None | None | None | H-01, H-12 |
| `/api/documents` | POST | None | None | Zod | H-01, H-10 |
| `/api/documents` | PUT | None | None | Zod (partial) | H-01, H-10 |
| `/api/documents` | DELETE | None | None | Query param only | H-01 |
| `/api/calculate` | POST | None | None | Zod | H-01, H-10 |
| `/api/forms` | POST | None | None | Zod | H-01, H-10 |

### 2.2 Path Traversal — JSON Database (CRITICAL)

**File:** `src/lib/db/json.ts`  
**Affected functions:** `getReturn()`, `saveReturn()`, `deleteReturn()`

```typescript
// Line 11-13 — No sanitization of `id` parameter
function filePath(id: string): string {
  return path.join(DB_DIR, `${id}.json`);
}
```

**Exploit:** A request to any endpoint accepting an `id` parameter with value `../../etc/passwd` resolves to `/app/data/db/../../etc/passwd.json`. While the `.json` suffix limits direct file reading, `saveReturn()` can be used to **write arbitrary JSON content** to paths outside the DB directory:

```
POST /api/documents (with crafted id)
→ JsonDatabase.saveReturn({ id: "../../app/server.js", ... })
→ Writes to /app/data/db/../../app/server.js.json
```

The `path.join()` behavior with `..` segments allows traversal. The `.json` suffix partially mitigates read attacks but does not prevent write-based attacks or enumeration of the DB directory.

**CVSSv3.1:** 8.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)

### 2.3 File Upload Attack Vectors

**File:** `src/modules/user-flow/steps/upload-step.tsx` (client-side), `src/app/api/documents/extract/route.ts` (server-side)

**Finding:** File type validation relies solely on HTML `accept="image/*,.pdf"` attribute on the client, which is trivially bypassed by sending a crafted HTTP request with any file type. The server-side extract route performs **zero file type validation**:

```typescript
// extract/route.ts line 22-25 — No MIME check, no magic bytes, no extension check
const file = formData.get('file');
if (!file || !(file instanceof File)) {
  return NextResponse.json({ error: 'File is required' }, { status: 400 });
}
// File is passed directly to extractDocument() with no validation
```

An attacker can upload:
- Executable files (stored temporarily in memory, processed by OCR)
- Polyglot files (PDF header + embedded JavaScript)
- Extremely large files (up to Akash's 50MB limit) to trigger resource exhaustion

### 2.4 OCR Injection Risk

**File:** `src/modules/document-extraction/mappers/w2-mapper.ts`

The SSN regex `\b(\d{3})[ -]?(\d{2})[ -]?(\d{4})\b` operates on raw OCR text. A crafted document could contain:
- Multiple 9-digit sequences to poison the confidence scoring
- Strings designed to match the EIN pattern `\b(\d{2})[ -]?(\d{7})\b` to inject false employer identifiers
- Formatted text that causes the field mapper regex patterns to match incorrect values

While this doesn't directly enable code execution, it can produce incorrect tax calculations that pass validation.

### 2.5 No CSRF Protection

All mutation endpoints (POST/PUT/DELETE) lack CSRF tokens. A malicious website could trigger:
- `POST /api/documents` to inject false documents
- `POST /api/calculate` to force tax calculations with attacker-controlled data
- `DELETE /api/documents?id=...` to delete legitimate documents

Next.js does not provide built-in CSRF protection for API routes.

---

## 3. Data Protection Assessment

### 3.1 Encryption at Rest — ABSENT

**Finding:** Tax return records are stored as plain JSON files in `/app/data/db/` on the Akash persistent volume (beta2 storage class). The volume is mounted at `/app/data` with no encryption layer.

```json
// Example: /app/data/db/abc-123.json (unencrypted at rest)
{
  "id": "abc-123",
  "taxpayer": {
    "firstName": "John",
    "lastName": "Doe",
    "ssnMasked": "XXX-XX-1234",
    "address": { "street": "123 Main St", "city": "Newark", "state": "NJ", "zip": "07102" }
  },
  "documents": [...],
  "calculatedReturn": {...}
}
```

Anyone with access to the Akash provider's storage infrastructure can read all tax return data.

### 3.2 Encryption in Transit — PARTIAL

**Finding:** The application does not enforce HTTPS at the application level. `deploy.yml` relies on Akash's ingress for TLS termination, but:
- No HSTS header is set (no `Strict-Transport-Security`)
- No HTTP→HTTPS redirect at application level
- No certificate pinning
- If Akash ingress is misconfigured or a direct IP connection is made, traffic is unencrypted

### 3.3 Access Controls — ABSENT

**Finding:** There is no authentication, authorization, or session management system:
- No login page or API
- No session tokens, JWTs, or cookies
- No user isolation — all users share the same in-memory document store (`Map<string, ExtractedDocument>` in `src/app/api/documents/route.ts`)
- No role-based access control
- No API key mechanism

### 3.4 Browser-Side PII Persistence

**File:** `src/stores/tax-return-store.ts`

```typescript
// Lines 177-184 — PII persisted unencrypted to localStorage
persist(
  (set, get) => ({...}),
  {
    name: 'tax-return-store',
    partialize: (state) => ({
      taxpayer: state.taxpayer,      // Contains ssnMasked, name, address, dependents
      documents: state.documents,      // All extracted data including SSNs, EINs, amounts
      additionalAnswers: state.additionalAnswers,
      // ...
    }),
  }
)
```

Any XSS vulnerability (see Section 2.6) allows immediate exfiltration of all stored PII from localStorage.

---

## 4. Infrastructure Security Assessment

### 4.1 Akash Deployment Security

**File:** `deploy.yml`

| Setting | Value | Risk |
|---------|-------|------|
| `global: true` | Exposed to entire internet | No IP allowlisting, no WAF |
| `max_body_size: 52428800` | 50MB | Enables large file upload attacks |
| `read_timeout: 60000` | 60s | Enables slow-loris style attacks |
| Storage class: `beta2` | Persistent volume | Unencrypted, provider-accessible |
| `count: 1` | Single instance | No redundancy, no failover |

### 4.2 Docker Image Security

**File:** `Dockerfile`

**Positive findings:**
- Multi-stage build (reduces attack surface of final image)
- Non-root user (`nextjs`) for runtime
- `npm ci` with cache clean

**Negative findings:**
- `node:20-slim` not pinned to specific patch version → non-deterministic builds
- Tesseract OCR installed in runtime image (increases attack surface)
- No `HEALTHCHECK` instruction
- No `--no-install-recommends` missing on some apt-get calls (builder stages)

### 4.3 CI/CD Supply Chain Risks

**File:** `.github/workflows/docker-publish.yml`

| Issue | Detail |
|-------|--------|
| No vulnerability scanning | No Trivy, Grype, Snyk, or equivalent step |
| Actions not pinned by SHA | `actions/checkout@v4`, `docker/login-action@v3` use tags, not commit SHAs |
| No SBOM generation | No Software Bill of Materials produced |
| No image signing | No Cosign/Notation signing of pushed images |
| Triggers on any push to main | No branch protection requirements documented |

### 4.4 Dependency Risk Summary

**File:** `package.json`

| Package | Version | Notes |
|---------|---------|-------|
| `next` | 14.2.35 | Active — check for CVEs regularly |
| `pdfjs-dist` | ^5.5.207 | PDF parsing — historically CVE-prone |
| `tesseract.js` | ^7.0.0 | WebAssembly in browser — large attack surface |
| `sharp` | ^0.34.5 | Image processing — native binary, CVE-prone |
| `canvas` | ^3.2.2 | Native bindings — increases container attack surface |
| `zod` | ^4.3.6 | v4 is relatively new — monitor for issues |
| No `npm audit` in CI | — | Dependency vulnerabilities not checked in pipeline |

---

## 5. Compliance Gap Analysis

### 5.1 IRS e-File Requirements (Publication 1345)

| Requirement | Status | Gap |
|-------------|--------|-----|
| Authentication of e-file provider | ❌ Not met | No identity verification system |
| Encryption of taxpayer data in transit | ⚠️ Partial | Relies on Akash ingress; no HSTS, no app-level enforcement |
| Encryption of taxpayer data at rest | ❌ Not met | Plain JSON files on unencrypted volume |
| Access controls limiting data access | ❌ Not met | No auth system exists |
| Audit trail of data access | ❌ Not met | No server-side access logging |
| Data retention and deletion controls | ❌ Not met | No data lifecycle management |
| Complete SSN on filed forms | ❌ Not met | PDFs contain only masked SSN — forms are e-file incompatible |
| IRS acceptance testing | ❌ Not met | No mention of IRS AMS/CAF testing |

### 5.2 NJ Data Breach Notification Law (N.J.S.A. 56:8-163)

| Requirement | Status | Gap |
|-------------|--------|-----|
| Encryption of PII at rest | ❌ Not met | NJ law provides safe harbor for encrypted data; unencrypted JSON files have no safe harbor |
| Breach detection capability | ❌ Not met | No logging, no monitoring, no alerting |
| Breach notification procedure | ❌ Not met | No incident response plan documented |

### 5.3 NJ Identity Theft Prevention Act (N.J.S.A. 56:11-45+)

Tax preparation services in NJ must implement specific safeguards including:
- Secure disposal of PII (no mechanism exists)
- Employee background checks (N/A for software-only, but relevant if support staff added)
- Written information security program (not documented)

### 5.4 General Data Protection Considerations

- **No privacy policy** is served by the application
- **No data processing notice** for users
- **No consent mechanism** for data collection
- **No data export/deletion** capability for users (GDPR Art. 17 right to erasure, CCPA right to delete)

---

## 6. Risk Matrix

### Critical Severity

| ID | Finding | CVSS | Exploitability | Impact |
|----|---------|------|----------------|--------|
| C-01 | **Path traversal in JSON database** (`json.ts:filePath()`) | 8.1 | **Trivial** — craft `id` parameter with `../` sequences | Read/write files outside DB directory; potential server.js overwrite |
| C-02 | **No authentication or authorization** on any endpoint | 9.8 | **Trivial** — send HTTP request | Full access to all users' tax data; data injection, deletion, manipulation |
| C-03 | **No encryption at rest** for tax return data | 9.1 | **Easy** — access Akash provider storage | Full exfiltration of all stored tax returns including PII and financial data |
| C-04 | **Unencrypted PII in browser localStorage** (`tax-return-store` key) | 7.5 | **Easy** — XSS or physical access | Exfiltration of taxpayer name, address, masked SSN, all financial data |
| C-05 | **No security headers** (CSP, X-Frame-Options, HSTS, X-Content-Type-Options) | 7.5 | **Easy** — frame the site, exploit lack of CSP | Clickjacking, XSS execution, MIME sniffing attacks |
| C-06 | **PDFs contain only masked SSN** — e-file incompatible | N/A (functional) | **N/A** — architectural | Product cannot fulfill its stated purpose; generates non-filing-ready forms |

### High Severity

| ID | Finding | CVSS | Exploitability | Impact |
|----|---------|------|----------------|--------|
| H-01 | **Shared in-memory document store** — no user isolation | 8.6 | **Trivial** — call GET /api/documents | Read/modify/delete any user's uploaded documents |
| H-02 | **No rate limiting** on any API endpoint | 7.5 | **Easy** — scripted requests | DoS via OCR processing; resource exhaustion on 2GiB memory limit |
| H-03 | **No file type validation** on upload (server-side) | 7.5 | **Trivial** — craft multipart request | Upload malicious files; trigger unexpected code paths in OCR |
| H-04 | **Error messages leak internal details** (all API routes) | 5.3 | **Trivial** — send malformed request | Information disclosure: internal paths, library names, stack traces |
| H-05 | **No CSRF protection** on mutation endpoints | 8.0 | **Easy** — cross-origin form submission | Forced document injection, calculation manipulation, data deletion |
| H-06 | **No input sanitization** beyond Zod schema | 6.1 | **Moderate** — inject HTML/script in string fields | Stored XSS via document labels, taxpayer name fields |
| H-07 | **Duplicate extract endpoints** (`/api/documents/extract` + `/api/extract`) | 5.3 | **N/A** | Increased attack surface; inconsistent validation between endpoints |
| H-08 | **No HTTPS enforcement** at application level | 6.5 | **Easy** — connect via HTTP if ingress misconfigured | Intercept all PII in transit |
| H-09 | **No container image vulnerability scanning** in CI/CD | 6.5 | **Easy** — push vulnerable image | Deploy containers with known CVEs in native dependencies (sharp, canvas, tesseract) |

### Medium Severity

| ID | Finding | CVSS | Exploitability | Impact |
|----|---------|------|----------------|--------|
| M-01 | **Full SSN in browser memory** during OCR processing | 6.5 | **Moderate** — requires memory dump or XSS | Exfiltration of complete SSN from OCR text |
| M-02 | **SSN regex overly broad** — no range validation | 3.7 | **Easy** | False positive SSN matches from non-SSN numeric sequences in OCR |
| M-03 | **EIN pattern false-positive risk** | 3.1 | **Easy** | Incorrect employer identification in extracted data |
| M-04 | **No CORS configuration** | 4.3 | **Moderate** | Cross-origin data access if default policy is permissive |
| M-05 | **Error data written to localStorage** (`taxfile_errors` key) | 3.1 | **Easy** | Information leakage via browser storage |
| M-06 | **No server-side audit logging** | 5.3 | **N/A** | Cannot detect or investigate unauthorized access |
| M-07 | **No Content-Disposition on PDF downloads** | 3.1 | **Easy** | MIME sniffing; browser may handle PDF unexpectedly |
| M-08 | **Akash global exposure** with no WAF or IP restrictions | 5.3 | **Easy** | Direct attack surface from any internet source |
| M-09 | **CI actions not pinned by SHA** | 4.3 | **Difficult** — requires GitHub account compromise | Supply chain attack via action tag redirection |

### Low Severity

| ID | Finding | Exploitability | Impact |
|----|---------|----------------|--------|
| L-01 | **No application-level request body size limit** | Easy | Relies solely on Akash 50MB limit |
| L-02 | **Silent error swallowing in DB layer** (empty catch blocks) | N/A | Masks security-relevant failures |
| L-03 | **Dockerfile base image not patch-pinned** (`node:20-slim`) | Difficult | Non-deterministic builds; potential for unintentional vulnerability introduction |
| L-04 | **Tesseract worker not terminated on navigation** | Easy | Unnecessary memory retention; stale OCR data in browser |
| L-05 | **No health check in Dockerfile** | N/A | Deployment orchestrator cannot detect unhealthy containers |

---

## 7. Remediation Priority

### Phase 1 — Block Release (Critical + High)

1. **Sanitize `id` in `json.ts:filePath()`** — Reject any ID containing `..`, `/`, or `\\`. Use a UUID validation regex. This is a one-line fix.
2. **Implement authentication** — Minimum: session-based auth with username/password. Recommended: OAuth 2.0 / OIDC with a provider like Auth0 or Clerk.
3. **Add encryption at rest** — Encrypt JSON DB files using AES-256-GCM with a key derived from a KMS. Alternatively, migrate to PostgreSQL with column-level encryption or Transparent Data Encryption.
4. **Remove PII from localStorage** — Remove the `persist` middleware from the Zustand store or exclude all PII fields from `partialize`. Use server-side session storage instead.
5. **Add security headers** — Implement via `next.config.mjs` headers or `src/middleware.ts`: CSP (strict), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Strict-Transport-Security with max-age ≥ 31536000.
6. **Add rate limiting** — Use `next-rate-limiter` or middleware-based rate limiting. Suggested: 100 req/min for read endpoints, 10 req/min for extract/calculate/forms.
7. **Add file type validation** — Validate MIME type AND check file magic bytes server-side. Reject non-PDF/non-image files before OCR processing.
8. **Add user isolation** — Replace the global `Map` in `/api/documents/route.ts` with per-user data scoped to the authenticated session.
9. **Sanitize error messages** — Return generic error messages to clients; log detailed errors server-side only.
10. **Add CSRF protection** — Use Next.js middleware with double-submit cookie pattern or `SameSite=Strict` cookies with auth tokens.
11. **Add container image scanning** — Add Trivy step to CI pipeline before push.
12. **Implement full SSN capture and secure storage** — Add SSN input fields, encrypt SSNs at rest, include full SSN in PDF output for e-file compatibility.

### Phase 2 — Hardening (Medium)

13. Sanitize all string inputs (HTML encoding, script tag stripping)
14. Add CORS configuration restricting to known origins
15. Implement server-side audit logging for all API access
16. Add proper Content-Disposition headers to PDF downloads
17. Configure Akash deployment with IP allowlisting or front with WAF
18. Pin GitHub Actions by commit SHA
19. Add npm audit step to CI pipeline
20. Pin Dockerfile base image to specific digest

### Phase 3 — Compliance (Low + Compliance Gaps)

21. Implement data retention and deletion policies
22. Add privacy policy page
23. Implement user data export/deletion API (GDPR/CCPA compliance)
24. Document information security program (NJ Identity Theft Prevention Act)
25. Add Docker HEALTHCHECK instruction
26. Terminate Tesseract worker on component unmount
27. Add IRS AMS/CAF testing roadmap
28. Remove duplicate `/api/extract` endpoint

---

## 8. Positive Security Observations

1. **No console.log statements** — HARNESS.md PII rule followed; zero `console.log/warn/error` found in source
2. **TypeScript strict mode** — Reduces injection risks from type confusion
3. **Zod validation on all API inputs** — Structural validation prevents malformed request bodies
4. **Multi-stage Docker build** — Reduces final image attack surface
5. **Non-root container user** — `nextjs` user (UID 1001) for runtime
6. **SSN masking in type system** — `ssnMasked: string` type prevents accidental full SSN storage in most paths
7. **Synthetic test data only** — `/data/` contains only test data per HARNESS.md rules
8. **Document storage paths do not include PII** — Files referenced by UUID, not user-identifying information
9. **File upload limit in Akash** — 50MB `max_body_size` prevents unlimited upload attacks
10. **Error boundary in OCR pipeline** — `logError()` uses try/catch with silent fail, preventing error-based crashes

---

*End of Report*
