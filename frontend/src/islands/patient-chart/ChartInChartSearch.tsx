import type { ChartSearchResultItem, ChartTabId } from './patientChartTypes';
import { useChartInChartSearch } from './useChartInChartSearch';

interface ChartInChartSearchProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  onNavigate: (tab: ChartTabId, anchor?: string) => void;
}

export function ChartInChartSearch({
  ajaxUrl,
  csrfToken,
  pid,
  onNavigate,
}: ChartInChartSearchProps) {
  const { query, results, loading, error, handleInput, clearSearch } = useChartInChartSearch({
    ajaxUrl,
    csrfToken,
    pid,
    enabled: true,
  });

  const showResults = query.trim().length >= 2;

  return (
    <section className="oe-nc-chart-in-chart-search mb-3" aria-label="Search within chart">
      <label className="sr-only" htmlFor="nc-chart-in-chart-search-input">
        Search within chart
      </label>
      <div className="oe-nc-search-input__wrap">
        <i className="fa fa-search oe-nc-search-input__icon" aria-hidden="true" />
        <input
          id="nc-chart-in-chart-search-input"
          type="search"
          className="form-control oe-nc-search-input__field"
          placeholder="Search this chart (medications, problems, labs…)"
          value={query}
          onChange={(event) => handleInput(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <span className="oe-nc-search-input__spinner" aria-hidden="true">
            <i className="fa fa-spinner fa-spin" />
          </span>
        )}
        {query && !loading && (
          <button
            type="button"
            className="oe-nc-search-input__clear"
            aria-label="Clear chart search"
            onClick={clearSearch}
          >
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="small text-muted mb-0 mt-1">
        Informational lookup only — not clinical decision support.
      </p>

      {showResults && error && <div className="alert alert-danger mt-2 mb-0 py-2">{error}</div>}

      {showResults && !error && !loading && results && results.items.length === 0 && (
        <p className="small text-muted mt-2 mb-0">No matches in this chart.</p>
      )}

      {showResults && results && results.items.length > 0 && (
        <ul className="list-group mt-2 oe-nc-chart-in-chart-search__results">
          {results.items.map((item) => (
            <ChartSearchResultRow
              key={`${item.category}-${item.id ?? item.title}-${item.anchor ?? item.tab}`}
              item={item}
              onNavigate={onNavigate}
            />
          ))}
          {results.truncated && (
            <li className="list-group-item small text-muted py-2">
              Showing first matches only — refine your search.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function ChartSearchResultRow({
  item,
  onNavigate,
}: {
  item: ChartSearchResultItem;
  onNavigate: (tab: ChartTabId, anchor?: string) => void;
}) {
  return (
    <li className="list-group-item list-group-item-action p-0">
      <button
        type="button"
        className="btn btn-link btn-block text-left px-3 py-2 oe-nc-chart-in-chart-search__result"
        onClick={() => onNavigate(item.tab, item.anchor)}
      >
        <span className="d-flex justify-content-between align-items-start">
          <span>
            <span className="font-weight-bold d-block">{item.title}</span>
            {item.detail && <span className="small text-muted d-block">{item.detail}</span>}
          </span>
          <span className="badge badge-light ml-2 shrink-0">{item.category}</span>
        </span>
      </button>
    </li>
  );
}
