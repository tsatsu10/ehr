import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
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
    <section className="nc-chart-in-chart-search mb-3" aria-label="Search within chart">
      <label className="sr-only" htmlFor="nc-chart-in-chart-search-input">
        Search within chart
      </label>
      <div className="nc-search-input-wrap">
        <i className="fa fa-search nc-search-input-icon" aria-hidden="true" />
        <Input
          id="nc-chart-in-chart-search-input"
          type="search"
          className="nc-search-input-field h-8"
          placeholder="Search this chart (medications, problems, labs…)"
          value={query}
          onChange={(event) => handleInput(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <span className="nc-search-input-spinner" aria-hidden="true">
            <i className="fa fa-spinner fa-spin" />
          </span>
        )}
        {query && !loading && (
          <button
            type="button"
            className="nc-search-input-clear"
            aria-label="Clear chart search"
            onClick={clearSearch}
          >
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0 mt-1">
        Informational lookup only — not clinical decision support.
      </p>

      {showResults && error && <div className={deskCalloutClass('error', 'mt-2 mb-0 py-2')}>{error}</div>}

      {showResults && !error && !loading && results && results.items.length === 0 && (
        <p className="text-sm text-[var(--oe-nc-text-muted)] mt-2 mb-0">No matches in this chart.</p>
      )}

      {showResults && results && results.items.length > 0 && (
        <ul className="nc-list-group mt-2 nc-chart-in-chart-search-results">
          {results.items.map((item) => (
            <ChartSearchResultRow
              key={`${item.category}-${item.id ?? item.title}-${item.anchor ?? item.tab}`}
              item={item}
              onNavigate={onNavigate}
            />
          ))}
          {results.truncated && (
            <li className="nc-list-group-item text-sm text-[var(--oe-nc-text-muted)] py-2">
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
    <li className="nc-list-group-item nc-list-group-item-action p-0">
      <Button
        type="button"
        variant="link"
        className="block w-full text-left px-3 py-2 h-auto nc-chart-in-chart-search-result"
        onClick={() => onNavigate(item.tab, item.anchor)}
      >
        <span className="flex justify-between items-start">
          <span>
            <span className="font-bold block">{item.title}</span>
            {item.detail && <span className="text-sm text-[var(--oe-nc-text-muted)] block">{item.detail}</span>}
          </span>
          <Badge variant="outline" className="ml-2 shrink-0">{item.category}</Badge>
        </span>
      </Button>
    </li>
  );
}
