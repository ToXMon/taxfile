"use client";

/**
 * Forms Viewer + Download Step
 * Tab/accordion per form, PDF preview (iframe), individual download,
 * download all as ZIP (jszip), disclaimer before download.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTaxReturnStore } from '@/stores/tax-return-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import JSZip from 'jszip';

const DISCLAIMER_TEXT =
  'TaxFile is a self-preparation tool, not professional tax advice. The generated forms are based on the data you provided and automated calculations. These results should be reviewed by a qualified tax professional before filing with the IRS or state tax authority. TaxFile is not responsible for errors, omissions, or penalties resulting from the use of these forms.';

export function FormsStep(): JSX.Element {
  const { generatedForms, prevStep, setGeneratingForms, isGeneratingForms } = useTaxReturnStore();
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'individual' | 'zip' | null>(null);
  const [pendingFormName, setPendingFormName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSelectForm = useCallback((formName: string, blob: Blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setSelectedForm(formName);
  }, [previewUrl]);

  const handleDownloadSingle = useCallback((formName: string) => {
    setPendingAction('individual');
    setPendingFormName(formName);
    setDisclaimerOpen(true);
  }, []);

  const handleDownloadAll = useCallback(() => {
    setPendingAction('zip');
    setPendingFormName(null);
    setDisclaimerOpen(true);
  }, []);

  const executeAction = useCallback(async () => {
    setDisclaimerOpen(false);
    if (pendingAction === 'individual' && pendingFormName) {
      const form = generatedForms.find((f) => f.formName === pendingFormName);
      if (form) {
        const url = URL.createObjectURL(form.pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${form.formName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } else if (pendingAction === 'zip') {
      setGeneratingForms(true);
      try {
        const zip = new JSZip();
        for (const form of generatedForms) {
          const buffer = await form.pdfBlob.arrayBuffer();
          zip.file(`${form.formName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`, buffer);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'tax-forms.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } finally {
        setGeneratingForms(false);
      }
    }
    setPendingAction(null);
    setPendingFormName(null);
  }, [pendingAction, pendingFormName, generatedForms, setGeneratingForms]);

  if (generatedForms.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No forms generated yet. Please complete the tax calculation step first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form List + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generated Forms ({generatedForms.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {generatedForms.map((form) => (
                  <AccordionItem key={form.formName} value={form.formName}>
                    <AccordionTrigger
                      className={`text-sm ${selectedForm === form.formName ? 'text-primary' : ''}`}
                      onClick={() => handleSelectForm(form.formName, form.pdfBlob)}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">PDF</Badge>
                        {form.formName}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex gap-2">
                        <Button
                          size="sm" variant="outline"
                          onClick={() => handleSelectForm(form.formName, form.pdfBlob)}
                        >
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDownloadSingle(form.formName)}
                        >
                          Download
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* PDF Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedForm ?? 'Select a form to preview'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[600px] border rounded"
                  title={`Preview: ${selectedForm}`}
                />
              ) : (
                <div className="flex items-center justify-center h-[600px] text-muted-foreground border rounded">
                  Click a form to preview
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Download All ZIP */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>Back</Button>
        <Button onClick={handleDownloadAll} disabled={isGeneratingForms}>
          {isGeneratingForms ? 'Creating ZIP...' : 'Download All as ZIP'}
        </Button>
      </div>

      {/* Disclaimer Dialog */}
      <Dialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Disclaimer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{DISCLAIMER_TEXT}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDisclaimerOpen(false)}>Cancel</Button>
            <Button onClick={executeAction}>
              {pendingAction === 'zip' ? 'Download ZIP' : 'Download'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
