import { Loader2, Search, X } from 'lucide-react';
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
    <section className="nc-chart-in-chart-search nc-chart-section overflow-hidden rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))] px-4 py-3" aria-label="Search within chart">
      <label className="sr-only" htmlFor="nc-chart-in-chart-search-input">
        Search within chart
      </label>
      <div className="nc-search-input-wrap relative">
        <Search
          className="nc-search-input-icon pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--oe-nc-text-muted)]"
          aria-hidden
        />
        <Input
          id="nc-chart-in-chart-search-input"
          type="search"
          className="nc-search-input-field h-9 pl-9 pr-9"
          placeholder="Search this chart (medications, problems, labs…)"
          value={query}
          onChange={(event) => handleInput(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <span className="nc-search-input-spinner absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
            <Loader2 className="h-4 w-4 animate-spin text-[var(--oe-nc-primary)]" />
          </span>
        )}
        {query && !loading && (
          <button
            type="button"
            className="nc-search-input-clear absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--oe-nc-text-muted)] transition-colors hover:bg-[var(--oe-nc-bg-tint)] hover:text-[var(--oe-nc-text)]"
            aria-label="Clear chart search"
            onClick={clearSearch}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <p className="mb-0 mt-2 text-xs text-[var(--oe-nc-text-muted)]">
        Informational lookup only — not clinical decision support.
      </p>

      {showResults && error && <div className={deskCalloutClass('error', 'mt-2 mb-0 py-2')}>{error}</div>}

      {showResults && !error && !loading && results && results.items.length === 0 && (
        <p className="text-sm text-[var(--oe-nc-text-muted)] mt-2 mb-0">No matches in this chart.</p>
      )}

      {showResults && results && results.items.length > 0 && (
        <ul className="nc-chart-in-chart-search-results mt-3 flex flex-col gap-1 overflow-hidden rounded-lg border border-[var(--oe-nc-border)]">
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
    <li className="border-b border-[var(--oe-nc-border)] last:border-b-0">
      <Button
        type="button"
        variant="ghost"
        className="nc-chart-in-chart-search-result h-auto w-full justify-start rounded-none px-3 py-2.5 text-left hover:bg-[var(--oe-nc-bg-tint)]"
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
