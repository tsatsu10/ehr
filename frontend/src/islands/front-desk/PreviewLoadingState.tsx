/** Skeleton layout while patients.preview is loading. */
export function PreviewLoadingState() {
  return (
    <div className="oe-nc-preview-loading" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading patient preview</span>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="oe-nc-vb-skeleton oe-nc-preview-loading__avatar rounded-full shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <div
            className="oe-nc-vb-skeleton oe-nc-preview-loading__line oe-nc-preview-loading__line--title"
            aria-hidden="true"
          />
          <div
            className="oe-nc-vb-skeleton oe-nc-preview-loading__line oe-nc-preview-loading__line--meta"
            aria-hidden="true"
          />
        </div>
        <div
          className="oe-nc-vb-skeleton rounded-full shrink-0"
          style={{ width: '4rem', height: '4rem' }}
          aria-hidden="true"
        />
      </div>
      <div className="oe-nc-vb-skeleton mb-3 rounded-lg" style={{ height: '2.75rem' }} aria-hidden="true" />
      <div className="oe-nc-vb-skeleton mb-3 rounded-lg" style={{ height: '4.5rem' }} aria-hidden="true" />
      <div className="oe-nc-vb-skeleton rounded-lg" style={{ height: '6.5rem' }} aria-hidden="true" />
    </div>
  );
}
