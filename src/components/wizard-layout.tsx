"use client";

/**
 * Wizard Layout Shell
 * Consistent layout wrapper with header, progress bar, content area, and footer.
 * Wraps all wizard step components.
 */

import type { ReactNode } from 'react';
import { WizardProgress } from './wizard-progress';

interface WizardLayoutProps {
  children: ReactNode;
  title?: string;
}

export function WizardLayout({ children, title }: WizardLayoutProps): JSX.Element {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">TaxFile</h1>
              {title && <p className="text-sm text-muted-foreground">{title}</p>}
            </div>
            <p className="text-xs text-muted-foreground">Tax Year 2025</p>
          </div>
          <div className="mt-4">
            <WizardProgress />
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>

      <footer className="border-t mt-auto">
        <div className="container max-w-4xl mx-auto px-4 py-3">
          <p className="text-xs text-center text-muted-foreground">
            TaxFile is a self-preparation tool, not professional tax advice. Review results with a qualified tax professional.
          </p>
        </div>
      </footer>
    </div>
  );
}
