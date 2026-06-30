import { oeFetch } from '@core/oeFetch';
import { formatMoney } from '@core/formatMoney';
import type { ReportHubCard, ReportHubLens } from './reportHubTypes';

interface ReportHubLensPaneProps {
  lens: ReportHubLens;
  cards: ReportHubCard[];
  loading: boolean;
  error: string | null;
  reportsUrl: string;
  webroot: string;
  ajaxUrl: string;
  csrfToken: string;
}

function resolveHref(webroot: string, url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = webroot.replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

async function logReportOpen(
  ajaxUrl: string,
  csrfToken: string,
  reportKey: string,
): Promise<void> {
  try {
    await oeFetch<{ id: number }>('reports.export_run', {
      ajaxUrl,
      csrfToken,
      json: { report_key: reportKey, status: 'ok' },
    });
  } catch {
    // Audit failure must not block navigation to stock report.
  }
}

export function ReportHubLensPane({
  lens,
  cards,
  loading,
  error,
  reportsUrl,
  webroot,
  ajaxUrl,
  csrfToken,
}: ReportHubLensPaneProps) {
  if (lens === 'today') {
    return (
      <iframe
        title="Daily Reports"
        className="oe-nc-reporthub-embed"
        src={reportsUrl}
      />
    );
  }

  if (loading) {
    return <p className="text-muted mb-0">Loading report catalog…</p>;
  }

  if (error) {
    return <div className="alert alert-danger mb-0">{error}</div>;
  }

  const lensCards = cards.filter((card) => card.lens === lens);
  if (!lensCards.length) {
    return (
      <div className="oe-nc-reporthub-empty">
        <p className="mb-0 text-muted">No reports are available for this lens with your current role and clinic flags.</p>
      </div>
    );
  }

  return (
    <div className="oe-nc-reporthub-cards" role="list">
      {lensCards.map((card) => (
        <article key={card.id} className="oe-nc-reporthub-card" role="listitem">
          <h3 className="oe-nc-reporthub-card__title h6">{card.title}</h3>
          <p className="oe-nc-reporthub-card__blurb small text-muted mb-2">{card.blurb}</p>
          {card.note ? (
            <p className="oe-nc-reporthub-card__note small text-muted mb-2">{card.note}</p>
          ) : null}
          {card.kind === 'placeholder' || card.url === '' ? (
            <span className="badge badge-secondary">Coming soon</span>
          ) : (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => {
                const href = resolveHref(webroot, card.url);
                void logReportOpen(ajaxUrl, csrfToken, card.id).finally(() => {
                  const target = window.top ?? window;
                  target.location.href = href;
                });
              }}
            >
              Open report
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

export function formatHubSummaryLabel(
  currencySymbol: string,
  cashTotal: number,
  visitsStarted: number,
): string {
  const cash = formatMoney(cashTotal, { currency_symbol: currencySymbol });
  return `Today cash: ${cash} · Visits: ${visitsStarted}`;
}

export async function fetchHubSummary(
  ajaxUrl: string,
  csrfToken: string,
  visitDate: string,
) {
  return oeFetch<{
    visit_date: string;
    visits_started: number;
    cash_total: number;
    receipt_count: number;
    currency_symbol: string;
  }>('reports.hub_summary', {
    ajaxUrl,
    csrfToken,
    params: { visit_date: visitDate },
  });
}

export async function fetchHubCatalog(
  ajaxUrl: string,
  csrfToken: string,
  lens?: ReportHubLens,
) {
  return oeFetch<{
    lenses: ReportHubLens[];
    cards: ReportHubCard[];
    show_us_quality: boolean;
  }>('reports.catalog', {
    ajaxUrl,
    csrfToken,
    params: lens ? { lens } : undefined,
  });
}
