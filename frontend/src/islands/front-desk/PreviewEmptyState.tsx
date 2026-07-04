import { Search, UserPlus } from 'lucide-react';

/**
 * Empty state for the preview pane (mobile slide-over; desktop keeps search-only until select).
 */
export function PreviewEmptyState() {
  return (
    <div
      className="oe-nc-empty-state oe-nc-preview-empty flex flex-col items-center justify-center text-center py-10 px-6 min-h-[12rem]"
      id="nc-preview-empty"
    >
      <div
        className="oe-nc-preview-empty__icon flex items-center justify-center h-12 w-12 rounded-full bg-[var(--oe-nc-bg-tint)] text-[var(--oe-nc-text-muted)] mb-4"
        aria-hidden="true"
      >
        <Search className="h-5 w-5" />
      </div>
      <p className="oe-nc-preview-empty__title text-sm font-semibold text-[var(--oe-nc-text)] m-0 mb-1.5">
        No patient selected
      </p>
      <p className="oe-nc-preview-empty__hint text-sm text-[var(--oe-nc-text-muted)] m-0 mx-auto max-w-xs leading-relaxed">
        Search by name, phone, or MRN — then pick a row to preview and start a visit.
      </p>
      <p className="oe-nc-preview-empty__meta text-xs text-[var(--oe-nc-text-muted)] mt-3 m-0 flex items-center justify-center gap-1.5 flex-wrap">
        <span>
          Press <kbd className="oe-nc-kbd">/</kbd> to focus search
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <UserPlus className="h-3 w-3" aria-hidden="true" />
          Register for new patients
        </span>
      </p>
    </div>
  );
}
