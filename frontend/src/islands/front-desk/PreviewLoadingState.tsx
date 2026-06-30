/** Skeleton layout while patients.preview is loading. */
export function PreviewLoadingState() {
  return (
    <div className="oe-nc-preview-loading" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading patient preview</span>
      <div className="d-flex align-items-center mb-3">
        <div className="oe-nc-vb-skeleton oe-nc-preview-loading__avatar rounded-circle mr-3" aria-hidden="true" />
        <div className="flex-grow-1">
          <div className="oe-nc-vb-skeleton oe-nc-preview-loading__line oe-nc-preview-loading__line--title mb-2" aria-hidden="true" />
          <div className="oe-nc-vb-skeleton oe-nc-preview-loading__line oe-nc-preview-loading__line--meta" aria-hidden="true" />
        </div>
      </div>
      <div className="oe-nc-vb-skeleton mb-2" style={{ height: '2.5rem' }} aria-hidden="true" />
      <div className="oe-nc-vb-skeleton mb-2" style={{ height: '4rem' }} aria-hidden="true" />
      <div className="oe-nc-vb-skeleton" style={{ height: '6rem' }} aria-hidden="true" />
    </div>
  );
}
