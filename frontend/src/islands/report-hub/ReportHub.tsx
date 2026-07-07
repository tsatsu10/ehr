import { useCallback, useEffect, useMemo, useState } from 'react';
import { localDateString } from '@islands/daily-reports/reportsFormatters';
import {
  fetchHubCatalog,
  fetchHubSummary,
  formatHubSummaryLabel,
  logReportOpen,
  ReportHubLensPane,
} from './ReportHubLensPane';
import { ReportHubRunbooksPanel } from './ReportHubRunbooksPanel';
import type {
  ReportHubCard,
  ReportHubEmbedContext,
  ReportHubLens,
  ReportHubProps,
  ReportHubSummary,
} from './reportHubTypes';
import {
  allowedLenses,
  firstAllowedLens,
  useReportHubPageHeading,
} from './useReportHubPageHeading';
import './main.css';

function buildEmbedContext(
  props: ReportHubProps,
  visitDate: string,
): ReportHubEmbedContext {
  return {
    ajaxUrl: props.ajaxUrl,
    csrfToken: props.csrfToken,
    webroot: props.webroot,
    facilityId: props.facilityId,
    visitBoardUrl: props.visitBoardUrl,
    frontDeskUrl: props.frontDeskUrl,
    moduleUrl: props.moduleUrl,
    cashierUrl: props.cashierUrl,
    reportsUrl: props.reportsUrl,
    chartUrlBase: props.chartUrlBase,
    billingThreshold: props.billingThreshold,
    visitDate,
    canCancelVisit: props.canCancelVisit,
    canMarkUnpaid: props.canMarkUnpaid,
    canRunReconciliation: props.canRunReconciliation,
    scheduledIntegrationEnabled: props.scheduledIntegrationEnabled,
    canStartVisit: props.canStartVisit,
    billOps: {
      canCorrect: props.canBillOpsCorrect,
      canPayment: props.canBillOpsPayment,
      canClose: props.canBillOpsClose,
      canOutstanding: props.canBillOpsOutstanding,
      canInsurance: props.canBillOpsInsurance,
      reopenOnCorrection: props.reopenOnCorrection,
    },
    currencyFormat: props.currencyFormat,
  };
}

export function ReportHub(props: ReportHubProps) {
  const runbooks = props.runbooks ?? [];
  const tabs = useMemo(() => allowedLenses(props), [props]);
  const [tab, setTab] = useState<ReportHubLens>(() => firstAllowedLens(props.initialTab, tabs));
  const [visitDate, setVisitDate] = useState(localDateString);
  const [summary, setSummary] = useState<ReportHubSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [cards, setCards] = useState<ReportHubCard[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [refreshToken, setRefreshToken] = useState(0);

  const embedContext = useMemo(
    () => buildEmbedContext(props, visitDate),
    [props, visitDate],
  );

  const summaryLabel = useMemo(() => {
    if (!summary) return '';
    return formatHubSummaryLabel(
      summary.currency_symbol,
      summary.cash_total,
      summary.visits_started,
    );
  }, [summary]);

  const loadSummary = useCallback(async (date: string) => {
    setSummaryError(null);
    try {
      const data = await fetchHubSummary(props.ajaxUrl, props.csrfToken, date);
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setSummaryError(err instanceof Error ? err.message : 'Could not load today summary');
    }
  }, [props.ajaxUrl, props.csrfToken]);

  const loadCatalog = useCallback(async () => {
    if (tab === 'today') {
      setCards([]);
      setCatalogError(null);
      return;
    }
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const data = await fetchHubCatalog(props.ajaxUrl, props.csrfToken, tab);
      setCards(data.cards ?? []);
    } catch (err) {
      setCards([]);
      setCatalogError(err instanceof Error ? err.message : 'Could not load report catalog');
    } finally {
      setLoadingCatalog(false);
    }
  }, [props.ajaxUrl, props.csrfToken, tab]);

  const refresh = useCallback(() => {
    const today = localDateString();
    setVisitDate(today);
    setLastUpdated(new Date());
    setRefreshToken((token) => token + 1);
    void loadSummary(today);
    void loadCatalog();
  }, [loadCatalog, loadSummary]);

  useEffect(() => {
    void loadSummary(visitDate);
  }, [loadSummary, visitDate]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  }, [tab]);

  useEffect(() => {
    if (!props.canShowAdvanced) return undefined;

    const menu = document.querySelector('#nc-reporthub-toolbar .dropdown-menu');
    if (!menu) return undefined;

    const handler = (event: Event) => {
      const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[data-report-key]');
      if (!anchor?.dataset.reportKey) return;
      void logReportOpen(props.ajaxUrl, props.csrfToken, anchor.dataset.reportKey);
    };

    menu.addEventListener('click', handler);
    return () => menu.removeEventListener('click', handler);
  }, [props.ajaxUrl, props.canShowAdvanced, props.csrfToken]);

  useReportHubPageHeading({
    tab,
    summaryLabel,
    summaryError,
    lastUpdated,
    onTabChange: setTab,
    onRefresh: refresh,
  });

  return (
    <div className="nc-reporthub" id="nc-report-hub-root">
      <ReportHubLensPane
        lens={tab}
        cards={cards}
        loading={loadingCatalog}
        error={catalogError}
        summary={summary}
        summaryError={summaryError}
        embedContext={embedContext}
        refreshToken={refreshToken}
        webroot={props.webroot}
        ajaxUrl={props.ajaxUrl}
        csrfToken={props.csrfToken}
      />
      {runbooks.length > 0 && (
        <ReportHubRunbooksPanel cards={runbooks} />
      )}
    </div>
  );
}
