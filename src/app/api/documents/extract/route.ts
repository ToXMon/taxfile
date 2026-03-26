/**
 * POST /api/documents/extract
 * Accepts FormData with file + documentType, runs OCR extraction pipeline,
 * returns ExtractedDocument JSON.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractDocument } from '@/modules/document-extraction/pipeline';
import type { DocumentType } from '@/lib/types';

const DOCUMENT_TYPES = [
  'W2', '1099-INT', '1099-DIV', '1099-B', '1099-NEC',
  '1099-MISC', '1098', '1098-T', '1098-E', '1095-A', '1095-B', '1095-C',
] as const;

const extractSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const docTypeStr = formData.get('documentType');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    let typeHint: DocumentType | undefined;
    if (docTypeStr && typeof docTypeStr === 'string') {
      const parsed = extractSchema.safeParse({ documentType: docTypeStr });
      if (parsed.success) {
        typeHint = parsed.data.documentType;
      }
    }

    const extracted = await extractDocument(file, typeHint);

    return NextResponse.json({
      id: extracted.id,
      type: extracted.type,
      fields: extracted.fields,
      confidence: extracted.confidence,
      sourceFile: extracted.sourceFile,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
