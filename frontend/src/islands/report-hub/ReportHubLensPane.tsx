import { useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { formatMoney } from '@core/formatMoney';
import { DailyReports } from '@islands/daily-reports/DailyReports';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import type {
  ReportHubCard,
  ReportHubEmbedContext,
  ReportHubLens,
  ReportHubSummary,
} from './reportHubTypes';
import { ReportHubNativeCard } from './ReportHubNativeCard';
import { ReportHubEmbedView } from './ReportHubEmbedView';
import { resolveHubEmbedTarget, resolveHref } from './reportHubEmbed';
import {
  cardKindBadgeVariant,
  cardKindLabel,
  LENS_META,
} from './reportHubLensMeta';

interface ReportHubLensPaneProps {
  lens: ReportHubLens;
  cards: ReportHubCard[];
  loading: boolean;
  error: string | null;
  summary: ReportHubSummary | null;
  summaryError: string | null;
  embedContext: ReportHubEmbedContext;
  refreshToken?: number;
  webroot: string;
  ajaxUrl: string;
  csrfToken: string;
}

interface ActiveEmbedState {
  title: string;
  reportKey: string;
  note?: string;
  target: NonNullable<ReturnType<typeof resolveHubEmbedTarget>>;
}

const SCHEDULING_STOCK_IDS = new Set(['ph_encounters', 'ph_appointments']);

function ReportHubLensIntro({ lens, headingId }: { lens: ReportHubLens; headingId?: string }) {
  const meta = LENS_META[lens];
  return (
    <header className="nc-reporthub-lens">
      <div className="nc-reporthub-lens-icon" aria-hidden="true">
        <i className={`fa ${meta.icon}`} />
      </div>
      <div className="nc-reporthub-lens-copy">
        <h2 className="nc-reporthub-lens-title h5 mb-1" id={headingId}>{meta.title}</h2>
        <p className="nc-reporthub-lens-blurb mb-0">{meta.blurb}</p>
      </div>
    </header>
  );
}

function ReportHubSummaryStrip({
  summary,
  error,
}: {
  summary: ReportHubSummary | null;
  error: string | null;
}) {
  if (error) {
    return (
      <div className={deskCalloutClass('warn', 'nc-reporthub-summary-alert mb-3')} role="alert">
        <i className="fa fa-exclamation-triangle mr-2" aria-hidden="true" />
        {error}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="nc-reporthub-stats nc-reporthub-stats--loading mb-3" aria-hidden="true">
        <div className="nc-reporthub-stat nc-reporthub-stat--skeleton" />
        <div className="nc-reporthub-stat nc-reporthub-stat--skeleton" />
        <div className="nc-reporthub-stat nc-reporthub-stat--skeleton" />
      </div>
    );
  }

  const cash = formatMoney(summary.cash_total, { currency_symbol: summary.currency_symbol });

  return (
    <div className="nc-reporthub-stats mb-3" role="group" aria-label="Today at a glance">
      <div className="nc-reporthub-stat">
        <span className="nc-reporthub-stat-label">Cash collected</span>
        <span className="nc-reporthub-stat-value">{cash}</span>
      </div>
      <div className="nc-reporthub-stat">
        <span className="nc-reporthub-stat-label">Visits started</span>
        <span className="nc-reporthub-stat-value">{summary.visits_started}</span>
      </div>
      <div className="nc-reporthub-stat">
        <span className="nc-reporthub-stat-label">Receipts</span>
        <span className="nc-reporthub-stat-value">{summary.receipt_count}</span>
      </div>
    </div>
  );
}

function ReportHubLoadingGrid() {
  return (
    <div className="nc-reporthub-cards" aria-busy="true" aria-label="Loading report catalog">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={`skeleton-${index}`} className="nc-reporthub-card nc-reporthub-card--skeleton" />
      ))}
    </div>
  );
}

export async function logReportOpen(
  ajaxUrl: string,
  csrfToken: string,
  reportKey: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<void> {
  try {
    const body: Record<string, string> = { report_key: reportKey, status: 'ok' };
    if (dateFrom) body.date_from = dateFrom;
    if (dateTo) body.date_to = dateTo;
    await oeFetch<{ id: number }>('reports.export_run', {
      ajaxUrl,
      csrfToken,
      json: body,
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
  summary,
  summaryError,
  embedContext,
  refreshToken = 0,
  webroot,
  ajaxUrl,
  csrfToken,
}: ReportHubLensPaneProps) {
  const [activeEmbed, setActiveEmbed] = useState<ActiveEmbedState | null>(null);
  const meta = LENS_META[lens];

  useEffect(() => {
    setActiveEmbed(null);
  }, [lens]);

  if (lens === 'today') {
    return (
      <section className="nc-reporthub-pane" aria-labelledby="nc-reporthub-lens-today">
        <ReportHubLensIntro lens="today" headingId="nc-reporthub-lens-today" />
        <ReportHubSummaryStrip summary={summary} error={summaryError} />
        <div className="nc-reporthub-today">
          <DailyReports
            key={refreshToken}
            ajaxUrl={embedContext.ajaxUrl}
            csrfToken={embedContext.csrfToken}
            facilityId={embedContext.facilityId}
            visitBoardUrl={embedContext.visitBoardUrl}
            canCancelVisit={embedContext.canCancelVisit}
            canMarkUnpaid={embedContext.canMarkUnpaid}
            canRunReconciliation={embedContext.canRunReconciliation}
            scheduledIntegrationEnabled={embedContext.scheduledIntegrationEnabled}
            syncUrl={false}
            initialVisitDate={embedContext.visitDate}
            initialTab="visits"
          />
        </div>
      </section>
    );
  }

  const lensCards = cards.filter((card) => card.lens === lens);

  const openCard = (card: ReportHubCard) => {
    const target = resolveHubEmbedTarget(card, webroot);
    if (!target) {
      const href = resolveHref(webroot, card.url);
      void logReportOpen(ajaxUrl, csrfToken, card.id).finally(() => {
        const top = window.top ?? window;
        top.location.href = href;
      });
      return;
    }

    const schedulingNote = SCHEDULING_STOCK_IDS.has(card.id)
      ? 'Scheduling funnel — do not sum with M7 visit throughput.'
      : card.note;

    setActiveEmbed({
      title: card.title,
      reportKey: card.id,
      note: schedulingNote,
      target,
    });
    void logReportOpen(ajaxUrl, csrfToken, card.id);
  };

  return (
    <section className="nc-reporthub-pane" aria-labelledby={`nc-reporthub-lens-${lens}`}>
      <ReportHubLensIntro lens={lens} headingId={`nc-reporthub-lens-${lens}`} />

      {loading ? (
        <ReportHubLoadingGrid />
      ) : error ? (
        <div className={deskCalloutClass('error', 'nc-reporthub-alert mb-0')} role="alert">
          <i className="fa fa-exclamation-circle mr-2" aria-hidden="true" />
          {error}
        </div>
      ) : !lensCards.length ? (
        <div className="nc-reporthub-empty">
          <div className="nc-reporthub-empty-icon" aria-hidden="true">
            <i className={`fa ${meta.icon}`} />
          </div>
          <p className="nc-reporthub-empty-title mb-1">No reports available</p>
          <p className="nc-reporthub-empty-text mb-0">
            Nothing in the {meta.title.toLowerCase()} lens matches your role and clinic flags right now.
          </p>
        </div>
      ) : (
        <>
          {activeEmbed ? (
            <ReportHubEmbedView
              title={activeEmbed.title}
              target={activeEmbed.target}
              note={activeEmbed.note}
              context={embedContext}
              onClose={() => setActiveEmbed(null)}
            />
          ) : null}

          <div className={`nc-reporthub-cards${activeEmbed ? ' nc-reporthub-cards--dimmed' : ''}`} role="list">
            {lensCards.map((card) => {
              if (card.kind === 'native') {
                return (
                  <ReportHubNativeCard
                    key={card.id}
                    card={card}
                    ajaxUrl={ajaxUrl}
                    csrfToken={csrfToken}
                  />
                );
              }

              const schedulingNote = SCHEDULING_STOCK_IDS.has(card.id)
                ? 'Scheduling funnel — do not sum with M7 visit throughput.'
                : card.note;
              const canOpenInHub = card.url !== '' && card.kind !== 'placeholder'
                && resolveHubEmbedTarget(card, webroot) !== null;

              return (
                <article key={card.id} className="nc-reporthub-card" role="listitem">
                  <div className="nc-reporthub-card-head">
                    <h3 className="nc-reporthub-card-title text-base font-semibold mb-0">{card.title}</h3>
                    <Badge variant={cardKindBadgeVariant(card.kind)} className="nc-reporthub-card-badge">
                      {cardKindLabel(card.kind)}
                    </Badge>
                  </div>
                  <p className="nc-reporthub-card-blurb text-sm text-[var(--oe-nc-text-muted)] mb-2">{card.blurb}</p>
                  {schedulingNote ? (
                    <p className="nc-reporthub-card-note text-sm mb-2">{schedulingNote}</p>
                  ) : null}
                  {card.kind === 'placeholder' || card.url === '' ? (
                    <span className="nc-reporthub-card-soon text-[var(--oe-nc-text-muted)] text-sm">
                      <i className="fa fa-clock-o mr-1" aria-hidden="true" />
                      Planned for a future release
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="nc-reporthub-card-action"
                      onClick={() => openCard(card)}
                    >
                      <i
                        className={`fa ${canOpenInHub ? 'fa-window-maximize' : 'fa-external-link'} mr-1`}
                        aria-hidden="true"
                      />
                      {canOpenInHub ? 'Open in hub' : 'Open report'}
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
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
  return oeFetch<ReportHubSummary>('reports.hub_summary', {
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
