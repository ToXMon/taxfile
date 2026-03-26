"use client";

/**
 * Upload Wizard Step
 * Drag-drop upload, document type selector, progress indicator,
 * uploaded doc list with badges, delete, mobile camera capture, OCR via API.
 */

import { useCallback, useRef, useState } from 'react';
import type { DocumentType } from '@/lib/types';
import { useTaxReturnStore, WizardStep } from '@/stores/tax-return-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DOCUMENT_TYPES: DocumentType[] = [
  'W2', '1099-INT', '1099-DIV', '1099-B', '1099-NEC',
  '1099-MISC', '1098', '1098-T', '1098-E', '1095-A', '1095-B', '1095-C',
];

interface UploadState {
  isDragging: boolean;
  uploading: boolean;
  progress: number;
  currentFile: string;
}

export function UploadStep(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    isDragging: false, uploading: false, progress: 0, currentFile: '',
  });
  const [typeOverrides, setTypeOverrides] = useState<Record<string, DocumentType>>({});

  const { documents, addDocument, removeDocument, nextStep, canAdvance, markStepComplete } = useTaxReturnStore();

  const processFile = useCallback(async (file: File, docType: DocumentType) => {
    setUploadState({ isDragging: false, uploading: true, progress: 10, currentFile: file.name });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', docType);

    try {
      setUploadState((s) => ({ ...s, progress: 30 }));
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        body: formData,
      });
      setUploadState((s) => ({ ...s, progress: 70 }));

      if (!res.ok) throw new Error('Extraction failed');
      const extracted = await res.json();
      setUploadState((s) => ({ ...s, progress: 90 }));

      addDocument({
        id: crypto.randomUUID(),
        type: docType,
        sourceFile: file.name,
        fields: extracted.fields ?? {},
        confidence: extracted.confidence ?? {},
        reviewed: false,
      });
      setUploadState({ isDragging: false, uploading: false, progress: 100, currentFile: '' });
    } catch {
      setUploadState({ isDragging: false, uploading: false, progress: 0, currentFile: '' });
      alert('Failed to process document. Please try again.');
    }
  }, [addDocument]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const detectedType = typeOverrides[file.name] ?? detectTypeFromName(file.name);
      await processFile(file, detectedType);
    }
  }, [processFile, typeOverrides]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleAdvance = () => {
    markStepComplete(WizardStep.UPLOAD);
    nextStep();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Tax Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              uploadState.isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => { e.preventDefault(); setUploadState((s) => ({ ...s, isDragging: true })); }}
            onDragLeave={() => setUploadState((s) => ({ ...s, isDragging: false }))}
            onDrop={handleDrop}
          >
            <p className="text-sm text-muted-foreground mb-4">
              Drag and drop tax documents here, or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadState.uploading}>
              Browse Files
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <Button variant="outline" className="ml-2" onClick={() => cameraInputRef.current?.click()} disabled={uploadState.uploading}>
              Camera
            </Button>
          </div>

          {uploadState.uploading && (
            <div className="mt-4">
              <p className="text-sm mb-2">Processing: {uploadState.currentFile}</p>
              <Progress value={uploadState.progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border rounded p-3">
                <div className="flex items-center gap-3">
                  <Badge>{doc.type}</Badge>
                  <span className="text-sm">{doc.sourceFile}</span>
                  <Badge variant="outline">
                    {avgConfidence(doc.confidence)}%
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={typeOverrides[doc.sourceFile] ?? doc.type}
                    onValueChange={(v) => setTypeOverrides((p) => ({ ...p, [doc.sourceFile]: v as DocumentType }))}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => removeDocument(doc.id)}>Remove</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleAdvance} disabled={!canAdvance(WizardStep.UPLOAD)}>
          Continue to Review
        </Button>
      </div>
    </div>
  );
}

function detectTypeFromName(name: string): DocumentType {
  const upper = name.toUpperCase();
  if (upper.includes('W2') || upper.includes('W-2')) return 'W2';
  if (upper.includes('1099-INT')) return '1099-INT';
  if (upper.includes('1099-DIV')) return '1099-DIV';
  if (upper.includes('1099-B')) return '1099-B';
  if (upper.includes('1099-NEC')) return '1099-NEC';
  if (upper.includes('1099-MISC')) return '1099-MISC';
  if (upper.includes('1098-T')) return '1098-T';
  if (upper.includes('1098-E')) return '1098-E';
  if (upper.includes('1095-A')) return '1095-A';
  if (upper.includes('1095-B')) return '1095-B';
  if (upper.includes('1095-C')) return '1095-C';
  if (upper.includes('1098')) return '1098';
  return 'W2';
}

function avgConfidence(conf: Record<string, number>): number {
  const vals = Object.values(conf);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
