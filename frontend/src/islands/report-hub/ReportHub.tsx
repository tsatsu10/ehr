import { useCallback, useEffect, useMemo, useState } from 'react';
import { localDateString } from '@islands/daily-reports/reportsFormatters';
import {
  fetchHubCatalog,
  fetchHubSummary,
  formatHubSummaryLabel,
  ReportHubLensPane,
} from './ReportHubLensPane';
import type { ReportHubCard, ReportHubLens, ReportHubProps } from './reportHubTypes';
import {
  allowedLenses,
  firstAllowedLens,
  useReportHubPageHeading,
} from './useReportHubPageHeading';
import './main.css';

export function ReportHub(props: ReportHubProps) {
  const tabs = useMemo(() => allowedLenses(props), [props]);
  const [tab, setTab] = useState<ReportHubLens>(() => firstAllowedLens(props.initialTab, tabs));
  const [visitDate] = useState(localDateString);
  const [summaryLabel, setSummaryLabel] = useState('');
  const [cards, setCards] = useState<ReportHubCard[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchHubSummary(props.ajaxUrl, props.csrfToken, visitDate);
      setSummaryLabel(formatHubSummaryLabel(
        data.currency_symbol,
        data.cash_total,
        data.visits_started,
      ));
    } catch {
      setSummaryLabel('');
    }
  }, [props.ajaxUrl, props.csrfToken, visitDate]);

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
    setLastUpdated(new Date());
    void loadSummary();
    void loadCatalog();
  }, [loadCatalog, loadSummary]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useReportHubPageHeading({
    tab,
    summaryLabel,
    lastUpdated,
    onTabChange: setTab,
    onRefresh: refresh,
  });

  return (
    <div className="oe-nc-reporthub" id="nc-report-hub-root">
      <ReportHubLensPane
        lens={tab}
        cards={cards}
        loading={loadingCatalog}
        error={catalogError}
        reportsUrl={props.reportsUrl}
        webroot={props.webroot}
        ajaxUrl={props.ajaxUrl}
        csrfToken={props.csrfToken}
      />
    </div>
  );
}
