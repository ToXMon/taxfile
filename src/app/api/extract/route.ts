/**
 * POST /api/extract
 * Accepts FormData with file(s) and optional typeHint per file.
 * Runs the extraction pipeline (OCR -> detect -> map -> flag).
 * Returns array of ExtractedDocument results and errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractDocuments } from '@/modules/document-extraction/pipeline';
import type { DocumentType } from '@/lib/types';

const SUPPORTED_TYPES: DocumentType[] = [
  'W2', '1099-INT', '1099-DIV', '1099-B', '1099-NEC',
  '1099-MISC', '1098', '1098-T', '1098-E', '1095-A', '1095-B', '1095-C',
];

function isValidTypeHint(val: string): val is DocumentType {
  return (SUPPORTED_TYPES as string[]).includes(val);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const files: Array<{ file: File; typeHint?: DocumentType }> = [];

    // Collect all file entries from FormData
    const entries = formData.entries();
    let entry = entries.next();
    while (!entry.done) {
      const [key, value] = entry.value;
      if (value instanceof File) {
        // Check for corresponding type hint (e.g., "file_0_type" -> "W2")
        const typeKey = `${key}_type`;
        const typeVal = formData.get(typeKey);
        const typeHint: DocumentType | undefined =
          typeof typeVal === 'string' && isValidTypeHint(typeVal)
            ? typeVal
            : undefined;
        files.push({ file: value, typeHint });
      }
      entry = entries.next();
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided in request' },
        { status: 400 },
      );
    }

    if (files.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 files per request' },
        { status: 400 },
      );
    }

    const { results, errors } = await extractDocuments(files);

    const hasErrors = errors.length > 0;
    const allFailed = results.length === 0;

    return NextResponse.json(
      {
        documents: results,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          totalFiles: files.length,
          extracted: results.length,
          failed: errors.length,
        },
      },
      { status: allFailed ? 422 : hasErrors ? 207 : 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
