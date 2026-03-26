/**
 * CRUD /api/documents
 * GET: list all documents (in-memory store)
 * POST: add a document
 * PUT: update a document by id
 * DELETE: remove a document by id
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ExtractedDocument, DocumentType } from '@/lib/types';

const documents: Map<string, ExtractedDocument> = new Map();

const taxLineItemSchema = z.object({
  value: z.number(),
  label: z.string(),
  source: z.object({ documentId: z.string(), formType: z.string(), boxNumber: z.string() }),
  trace: z.object({
    irsPublication: z.string().optional(),
    njTaxCode: z.string().optional(),
    calculationNote: z.string().optional(),
  }),
  flagged: z.boolean(),
});

const documentCreateSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'W2', '1099-INT', '1099-DIV', '1099-B', '1099-NEC',
    '1099-MISC', '1098', '1098-T', '1098-E', '1095-A', '1095-B', '1095-C',
  ]),
  sourceFile: z.string(),
  fields: z.record(z.string(), taxLineItemSchema),
  confidence: z.record(z.string(), z.number()),
  reviewed: z.boolean().optional(),
});

const documentUpdateSchema = z.object({
  type: z.enum([
    'W2', '1099-INT', '1099-DIV', '1099-B', '1099-NEC',
    '1099-MISC', '1098', '1098-T', '1098-E', '1095-A', '1095-B', '1095-C',
  ]).optional(),
  fields: z.record(z.string(), taxLineItemSchema).optional(),
  confidence: z.record(z.string(), z.number()).optional(),
  reviewed: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  const allDocs = Array.from(documents.values());
  return NextResponse.json({ documents: allDocs, count: allDocs.length });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = documentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const doc: ExtractedDocument = {
      ...parsed.data,
      reviewed: parsed.data.reviewed ?? false,
    };
    documents.set(doc.id, doc);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Document id is required' }, { status: 400 });
    }
    const existing = documents.get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const parsed = documentUpdateSchema.safeParse(updates);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const updated: ExtractedDocument = { ...existing, ...parsed.data };
    documents.set(id, updated);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Document id query parameter is required' }, { status: 400 });
  }
  if (!documents.has(id)) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  documents.delete(id);
  return NextResponse.json({ success: true, deleted: id });
}
