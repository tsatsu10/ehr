/**
 * Empty state for the preview pane. Only reachable on mobile (slide-over)
 * or after a registration cancel — desktop hides the preview pane entirely
 * when no patient is selected.
 */
export function PreviewEmptyState() {
  return (
    <div className="oe-nc-empty-state oe-nc-preview-empty text-center py-6 px-4" id="nc-preview-empty">
      <p className="oe-nc-preview-empty__hint text-sm text-[var(--oe-nc-text-muted)] m-0 mx-auto max-w-xs leading-relaxed">
        Pick a patient from the search list to see their preview here.
      </p>
    </div>
  );
}
