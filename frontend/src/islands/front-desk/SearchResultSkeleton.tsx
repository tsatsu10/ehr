/** Skeleton placeholders for patient search results while AJAX is in flight. */
export function SearchResultSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="oe-nc-search-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="oe-nc-search-skeleton__row">
          <div className="oe-nc-search-skeleton__avatar oe-nc-vb-skeleton" />
          <div className="oe-nc-search-skeleton__lines flex-1 min-w-0">
            <div className="oe-nc-vb-skeleton oe-nc-search-skeleton__line oe-nc-search-skeleton__line--title" />
            <div className="oe-nc-vb-skeleton oe-nc-search-skeleton__line oe-nc-search-skeleton__line--meta" />
          </div>
        </div>
      ))}
    </div>
  );
}
