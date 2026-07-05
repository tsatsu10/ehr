/** Skeleton placeholders for patient search results while AJAX is in flight. */
export function SearchResultSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="nc-search-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="nc-search-skeleton-row">
          <div className="nc-search-skeleton-avatar nc-vb-skeleton" />
          <div className="nc-search-skeleton-lines flex-1 min-w-0">
            <div className="nc-vb-skeleton nc-search-skeleton-line nc-search-skeleton-line-title" />
            <div className="nc-vb-skeleton nc-search-skeleton-line nc-search-skeleton-line-meta" />
          </div>
        </div>
      ))}
    </div>
  );
}
