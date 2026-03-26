# ============================================================
# TaxFile - Multi-stage Docker Build for Akash Network
# ============================================================

# ── Stage 1: Dependencies ──────────────────────────────────────
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

# ── Stage 2: Build ─────────────────────────────────────────────
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ── Stage 3: Runner ────────────────────────────────────────────
FROM node:20-slim AS runner

# Runtime native deps for canvas, sharp, tesseract.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    # canvas deps
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libjpeg62-turbo \
    libpng16-16 \
    libgif7 \
    # sharp deps (fallback if prebuilt binary missing)
    libvips42 \
    libglib2.0-0 \
    libexpat1 \
    # tesseract OCR (server-side fallback)
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone Next.js output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure data directory exists and is writable
RUN mkdir -p /app/data/db && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
