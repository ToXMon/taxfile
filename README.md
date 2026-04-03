# TaxFile

> Full-stack IRS e-file-ready tax preparation — upload documents, extract data via OCR, calculate taxes, generate fillable PDFs.

TaxFile prepares federal (Form 1040) and New Jersey state (NJ-1040) tax returns. Users upload W-2s, 1099s, and other tax documents, the app extracts data via OCR, runs all calculations with full audit trails, and produces completed tax forms as fillable PDFs.

## ✨ Features

- **Document OCR** — Tesseract.js (client-side) + sharp/tesseract (server-side fallback)
- **Federal tax engine** — Form 1040 with Schedules 1, 2, 3, A, B, D
- **New Jersey state** — NJ-1040 with state-specific calculations
- **Credit calculations** — EITC, education credits, child tax credit
- **PDF generation** — Fillable tax forms via @react-pdf/renderer
- **Wizard UX** — Step-by-step flow: upload → extract → review → file
- **Audit trails** — Every number traced to source document → form line → IRS publication
- **PII protection** — SSNs masked (XXX-XX-1234) in all non-encrypted contexts

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, standalone output) |
| Language | TypeScript (strict mode) |
| UI | Tailwind CSS + shadcn/ui |
| State | Zustand (client-side only) |
| OCR | Tesseract.js + sharp |
| PDF | @react-pdf/renderer |
| Database | JSON flat-file (dev) / Prisma + PostgreSQL (prod) |
| Tax Engine | Pure TypeScript — no external tax library |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- (Optional) PostgreSQL 16+ for production mode

### Setup

```bash
# Clone the repo
git clone https://github.com/ToXMon/taxfile.git
cd taxfile

# Install dependencies
npm ci

# Start dev server (JSON storage mode by default)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

See [`.env.example`](.env.example) for the full list.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE` | ❌ | `json` (default, local dev) or `prisma` (PostgreSQL production) |
| `DATABASE_URL` | With Prisma | PostgreSQL connection string |

### Production Mode (PostgreSQL)

Set `DATABASE=prisma` and provide `DATABASE_URL` in `.env`:

```bash
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

## 📐 Architecture

```
src/
├── app/                          # Next.js App Router pages + API routes
├── modules/
│   ├── document-extraction/       # OCR processing, field mapping, confidence scoring (11 files)
│   ├── tax-engine/                # Federal + NJ state tax calculations (22 files)
│   ├── forms-generation/          # PDF rendering of completed tax forms (8 files)
│   └── user-flow/                 # Wizard steps, progress tracking (6 files)
├── config/tax-year/2025/          # 2025 tax parameters (brackets, deductions, credits)
├── stores/                        # Zustand stores
├── components/ui/                 # shadcn/ui components
├── lib/
│   ├── types.ts                   # Centralized type definitions
│   ├── db/                        # Database interface (JSON + Prisma implementations)
│   └── utils.ts                   # Shared utilities
data/                             # Pipeline test output (gitignored, synthetic data only)
docs/state/                       # State diagrams archive
```

### Design Principles

- **No guessing** — ambiguities flagged with `TaxCalculationFlag`
- **No tax literals in code** — all amounts in config files under `src/config/tax-year/2025/`
- **Audit trail** — every number: source document → form line → IRS publication section
- **PII protection** — SSNs never in logs, console, or `/data/` outputs

## 🚢 Deployment

### Docker

```bash
docker build -t taxfile .
docker run -p 3000:3000 taxfile
```

The Docker image includes Tesseract OCR, canvas, and sharp native dependencies.

### Akash Network

See [`deploy.yml`](deploy.yml) for the Akash SDL. Push to `main` to trigger CI/CD, then update the image tag in `deploy.yml`.

### CI/CD

[`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) builds and pushes to GHCR on every push to `main`.

## 📄 License

Private — All rights reserved.
