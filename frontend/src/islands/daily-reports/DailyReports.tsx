import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch, OeFetchError } from '@core/oeFetch';
import { resolveDeskConflict } from '@core/deskConflict';
import { useInterval } from '@core/useInterval';
import { usePageHeadingDateInput } from '@core/usePageHeadingDateInput';
import { usePageHeadingRefresh, usePageHeadingUpdated } from '@core/usePageHeadingToolbar';
import { ReportsActionModals } from './ReportsActionModals';
import {
  BypassSection,
  CashSection,
  DataQualitySection,
  EodOpenSection,
  openVisitToPending,
  UnpaidSection,
  UnsignedSection,
  VisitsSection,
} from './ReportsSections';
import { initialReportTab, initialVisitDate } from './reportsFormatters';
import type {
  DailyReportData,
  DailyReportsProps,
  OpenVisitRow,
  PendingVisitAction,
  ReportTabId,
} from './reportsTypes';
import { REPORT_TABS } from './reportsTypes';

const POLL_MS = 30_000;

const EMPTY_REPORT: DailyReportData = {
  visit_date: '',
  facility_id: 0,
  visits: { started: 0, completed: 0, still_open: 0, cancelled: 0, by_state: {} },
  cash: { total_collected: 0, receipt_count: 0 },
  open_visits: [],
  eod_open: {},
  unsigned_alerts: { with_doctor: 0, ready_for_payment: 0 },
  unpaid_visits: [],
  data_quality: {
    patients_registered_today: 0,
    dup_overrides_today: 0,
    billing_threshold: 70,
    completion_buckets: { under_40: 0, from_40_to_69: 0, from_70_to_99: 0, complete_100: 0 },
    stale_incomplete: [],
  },
  unsigned_visits: [],
  queue_bypass: [],
  last_updated: '',
};

function isReportTabId(value: string): value is ReportTabId {
  return REPORT_TABS.some((tab) => tab.id === value);
}

export function DailyReports({
  ajaxUrl,
  csrfToken,
  facilityId,
  visitBoardUrl,
  canCancelVisit,
  canMarkUnpaid,
}: DailyReportsProps) {
  const [visitDate, setVisitDate] = useState(initialVisitDate);
  const [activeTab, setActiveTab] = useState<ReportTabId>(() => {
    const tab = initialReportTab();
    return isReportTabId(tab) ? tab : 'visits';
  });
  const [report, setReport] = useState<DailyReportData>(EMPTY_REPORT);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [cancelTarget, setCancelTarget] = useState<PendingVisitAction | null>(null);
  const [markUnpaidTarget, setMarkUnpaidTarget] = useState<PendingVisitAction | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [markUnpaidError, setMarkUnpaidError] = useState<string | null>(null);

  const fetchOptions = useMemo(
    () => ({ ajaxUrl, csrfToken }),
    [ajaxUrl, csrfToken]
  );

  const loadReport = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params: Record<string, string | number> = { visit_date: visitDate };
      const id = Number(facilityId ?? 0);
      if (id > 0) params.facility_id = id;

      const data = await oeFetch<DailyReportData>('reports.daily', {
        ...fetchOptions,
        params,
      });
      setReport(data);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Load failed';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions, facilityId, visitDate]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useInterval(
    () => { void loadReport(); },
    activeTab === 'open' ? POLL_MS : null
  );

  const handleDateChange = useCallback((date: string) => {
    setVisitDate(date);
    const url = new URL(window.location.href);
    url.searchParams.set('date', date);
    window.history.replaceState({}, '', url.toString());
  }, []);

  const handleTabChange = useCallback((tab: ReportTabId) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab !== 'visits') {
      url.searchParams.set('tab', tab);
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url.toString());
    if (tab === 'open') {
      void loadReport();
    }
  }, [loadReport]);

  const handleRefresh = useCallback(() => {
    void loadReport();
  }, [loadReport]);

  usePageHeadingDateInput('nc-reports-date', visitDate, handleDateChange);
  usePageHeadingRefresh('nc-reports-refresh', handleRefresh);
  usePageHeadingUpdated('nc-reports-updated', lastUpdated);

  const handleCancelOpen = useCallback((row: OpenVisitRow) => {
    setCancelError(null);
    setCancelTarget(openVisitToPending(row));
  }, []);

  const handleMarkUnpaidOpen = useCallback((row: OpenVisitRow) => {
    setMarkUnpaidError(null);
    setMarkUnpaidTarget(openVisitToPending(row));
  }, []);

  const handleConfirmCancel = useCallback(async (reason: string) => {
    if (!cancelTarget) return;
    setActionSubmitting(true);
    setCancelError(null);
    try {
      await oeFetch('visit.cancel', {
        ...fetchOptions,
        json: {
          visit_id: cancelTarget.visitId,
          row_version: cancelTarget.rowVersion,
          reason,
        },
      });
      setCancelTarget(null);
      await loadReport();
    } catch (err) {
      if (err instanceof OeFetchError) {
        const conflict = resolveDeskConflict(err);
        if (conflict?.type === 'stale_visit') {
          setCancelError(`${conflict.message} Refreshing report…`);
          setCancelTarget(null);
          await loadReport();
          return;
        }
      }
      setCancelError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setActionSubmitting(false);
    }
  }, [cancelTarget, fetchOptions, loadReport]);

  const handleConfirmMarkUnpaid = useCallback(async (reason: string) => {
    if (!markUnpaidTarget) return;
    setActionSubmitting(true);
    setMarkUnpaidError(null);
    try {
      await oeFetch('cashier.mark_unpaid', {
        ...fetchOptions,
        json: {
          visit_id: markUnpaidTarget.visitId,
          row_version: markUnpaidTarget.rowVersion,
          reason,
        },
      });
      setMarkUnpaidTarget(null);
      await loadReport();
    } catch (err) {
      if (err instanceof OeFetchError) {
        const conflict = resolveDeskConflict(err);
        if (conflict?.type === 'stale_visit') {
          setMarkUnpaidError(`${conflict.message} Refreshing report…`);
          setMarkUnpaidTarget(null);
          await loadReport();
          return;
        }
      }
      setMarkUnpaidError(err instanceof Error ? err.message : 'Mark unpaid failed');
    } finally {
      setActionSubmitting(false);
    }
  }, [fetchOptions, loadReport, markUnpaidTarget]);

  const errorBanner = loadError ? (
    <div className="alert alert-danger">{loadError}</div>
  ) : null;

  const tabContent = loading && !lastUpdated ? (
    <div className="text-muted"><em>Loading report…</em></div>
  ) : (
    <>
      {activeTab === 'visits' && <VisitsSection visits={report.visits} />}
      {activeTab === 'cash' && <CashSection cash={report.cash} />}
      {activeTab === 'open' && (
        <EodOpenSection
          summary={report.eod_open}
          visits={report.open_visits}
          unsignedAlerts={report.unsigned_alerts}
          visitBoardUrl={visitBoardUrl}
          canCancel={canCancelVisit}
          canMarkUnpaid={canMarkUnpaid}
          onCancel={handleCancelOpen}
          onMarkUnpaid={handleMarkUnpaidOpen}
        />
      )}
      {activeTab === 'unpaid' && <UnpaidSection rows={report.unpaid_visits} />}
      {activeTab === 'quality' && <DataQualitySection quality={report.data_quality} />}
      {activeTab === 'unsigned' && (
        <UnsignedSection rows={report.unsigned_visits} visitBoardUrl={visitBoardUrl} />
      )}
      {activeTab === 'bypass' && <BypassSection rows={report.queue_bypass} />}
    </>
  );

  return (
    <div id="nc-reports-desk">
      <ul className="nav nav-tabs mb-3" role="tablist">
        {REPORT_TABS.map((tab) => (
          <li className="nav-item" key={tab.id}>
            <button
              type="button"
              className={`nav-link${activeTab === tab.id ? ' active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="tab-content">
        {errorBanner}
        {tabContent}
      </div>

      <ReportsActionModals
        cancelTarget={cancelTarget}
        markUnpaidTarget={markUnpaidTarget}
        submitting={actionSubmitting}
        cancelError={cancelError}
        markUnpaidError={markUnpaidError}
        onCloseCancel={() => setCancelTarget(null)}
        onCloseMarkUnpaid={() => setMarkUnpaidTarget(null)}
        onConfirmCancel={(reason) => { void handleConfirmCancel(reason); }}
        onConfirmMarkUnpaid={(reason) => { void handleConfirmMarkUnpaid(reason); }}
      />
    </div>
  );
}
