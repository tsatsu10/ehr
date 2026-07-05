/**
 * App-wide Sonner mount — one toaster per React island root (UI plan §9 Phase C).
 */
import { Toaster } from 'sonner';

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            'nc-desk-toast rounded-lg border border-[var(--oe-nc-border,#e2e8f0)] bg-white shadow-lg',
          title: 'text-sm font-semibold text-[var(--oe-nc-text,#111827)]',
          description: 'text-sm text-[var(--oe-nc-text-muted,#6b7280)]',
        },
      }}
    />
  );
}
