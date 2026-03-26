import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

const FEATURES = [
  { icon: '📄', title: 'Document Upload', desc: 'W-2s, 1099s, 1098s' },
  { icon: '🔍', title: 'Smart Extraction', desc: 'OCR + field mapping' },
  { icon: '🧮', title: 'Tax Calculation', desc: 'Federal + NJ state' },
  { icon: '📋', title: 'E-File Ready', desc: 'Form 1040 & NJ-1040' },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-24">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-center">
          Tax<span className="text-primary">File</span>
        </h1>
        <p className="mt-3 text-lg md:text-xl text-muted-foreground text-center max-w-md">
          Federal &amp; New Jersey State Tax Preparation
        </p>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
          Upload your documents, review extracted data, and generate
          e-file-ready returns for the 2025 tax year.
        </p>
        <Link href="/return" className="mt-8">
          <Button size="lg" className="text-base px-8">
            Start Your Tax Return
          </Button>
        </Link>
      </section>

      {/* Features */}
      <section className="px-4 pb-12">
        <div className="max-w-2xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="text-center">
              <CardContent className="pt-6 pb-4 px-3">
                <div className="text-2xl mb-2">{f.icon}</div>
                <h3 className="font-semibold text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="max-w-2xl mx-auto" />

      {/* Disclaimer */}
      <footer className="px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Alert variant="destructive">
            <AlertDescription className="text-sm">
              TaxFile is a self-preparation tool, not professional tax advice.
              Results should be reviewed by a qualified tax professional before filing.
            </AlertDescription>
          </Alert>
        </div>
      </footer>
    </div>
  );
}
