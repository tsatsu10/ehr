import { useCallback, useEffect, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { SegmentedControl } from '@components/SegmentedControl';
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
  ReconciliationSection,
  UnpaidSection,
  UnsignedSection,
  VisitsSection,
} from './ReportsSections';
import { SchedulingSection } from './SchedulingSection';
import { AncillarySection } from './AncillarySection';
import { DocumentationIntegritySection } from './DocumentationIntegritySection';
import { initialReportTab, initialVisitDate, setReportCurrencyFormat } from './reportsFormatters';
import type {
  AncillaryReportData,
  DailyReportData,
  DailyReportsProps,
  DocumentationIntegrityReportData,
  OpenVisitRow,
  PendingVisitAction,
  ReportTabId,
  SchedulingReportData,
} from './reportsTypes';
import { REPORT_TABS } from './reportsTypes';

const POLL_MS = 30_000;

const EMPTY_REPORT: DailyReportData = {
  visit_date: '',
  facility_id: 0,
  visits: { started: 0, completed: 0, still_open: 0, cancelled: 0, by_state: {} },
  cash: { total_collected: 0, receipt_count: 0, by_category: [] },
  reconciliation: {
    status: 'ok',
    module_total: 0,
    core_total: 0,
    delta_amount: 0,
    tolerance: 0.01,
    currency_symbol: 'GH₵',
    latest_run: null,
    recent_runs: [],
  },
  open_visits: [],
  eod_open: {},
  unsigned_alerts: { with_doctor: 0, ready_for_payment: 0 },
  unpaid_visits: [],
  data_quality: {
    patients_registered_today: 0,
    dup_overrides_today: 0,
    billing_threshold: 70,
    completion_buckets: { under_40: 0, from_40_to_69: 0, from_70_to_99: 0, complete_100: 0 },
    by_registering_user: [],
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
  canRunReconciliation = false,
  scheduledIntegrationEnabled = false,
  ancillaryServicesEnabled = false,
  syncUrl = true,
  initialVisitDate: initialVisitDateProp,
  initialTab: initialTabProp,
}: DailyReportsProps) {
  const visibleTabs = useMemo(
    () => REPORT_TABS.filter((tab) => {
      if (tab.schedulingOnly && !scheduledIntegrationEnabled) {
        return false;
      }
      if (tab.ancillaryOnly && !ancillaryServicesEnabled) {
        return false;
      }
      return true;
    }),
    [ancillaryServicesEnabled, scheduledIntegrationEnabled],
  );
  const [visitDate, setVisitDate] = useState(() => initialVisitDateProp ?? initialVisitDate());
  const [ancillaryEndDate, setAncillaryEndDate] = useState(() => initialVisitDateProp ?? initialVisitDate());
  const [docIntegrityEndDate, setDocIntegrityEndDate] = useState(() => initialVisitDateProp ?? initialVisitDate());
  const [activeTab, setActiveTab] = useState<ReportTabId>(() => {
    if (initialTabProp) return initialTabProp;
    if (!syncUrl) return 'visits';
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
  const [reconRunning, setReconRunning] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);
  const [schedulingReport, setSchedulingReport] = useState<SchedulingReportData | null>(null);
  const [schedulingError, setSchedulingError] = useState<string | null>(null);
  const [ancillaryReport, setAncillaryReport] = useState<AncillaryReportData | null>(null);
  const [ancillaryError, setAncillaryError] = useState<string | null>(null);
  const [docIntegrityReport, setDocIntegrityReport] = useState<DocumentationIntegrityReportData | null>(null);
  const [docIntegrityError, setDocIntegrityError] = useState<string | null>(null);

  useEffect(() => {
    if (initialVisitDateProp) {
      setVisitDate(initialVisitDateProp);
      setAncillaryEndDate(initialVisitDateProp);
      setDocIntegrityEndDate(initialVisitDateProp);
    }
  }, [initialVisitDateProp]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('visits');
    }
  }, [activeTab, visibleTabs]);

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
      if (data.currency) {
        setReportCurrencyFormat(data.currency);
      }
      setReport(data);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Load failed';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions, facilityId, visitDate]);

  const loadScheduling = useCallback(async () => {
    setSchedulingError(null);
    try {
      const params: Record<string, string | number> = { visit_date: visitDate };
      const id = Number(facilityId ?? 0);
      if (id > 0) params.facility_id = id;
      const data = await oeFetch<SchedulingReportData>('reports.scheduling', {
        ...fetchOptions,
        params,
      });
      setSchedulingReport(data);
    } catch (err) {
      setSchedulingError(err instanceof Error ? err.message : 'Could not load scheduling report');
      setSchedulingReport(null);
    }
  }, [fetchOptions, facilityId, visitDate]);

  const loadAncillary = useCallback(async () => {
    setAncillaryError(null);
    try {
      const params: Record<string, string | number> = {
        start_date: visitDate,
        end_date: ancillaryEndDate,
      };
      const id = Number(facilityId ?? 0);
      if (id > 0) params.facility_id = id;
      const data = await oeFetch<AncillaryReportData>('reports.ancillary', {
        ...fetchOptions,
        params,
      });
      setAncillaryReport(data);
    } catch (err) {
      setAncillaryError(err instanceof Error ? err.message : 'Could not load ancillary report');
      setAncillaryReport(null);
    }
  }, [ancillaryEndDate, fetchOptions, facilityId, visitDate]);

  const loadDocIntegrity = useCallback(async () => {
    setDocIntegrityError(null);
    try {
      const params: Record<string, string | number> = {
        start_date: visitDate,
        end_date: docIntegrityEndDate,
      };
      const id = Number(facilityId ?? 0);
      if (id > 0) params.facility_id = id;
      const data = await oeFetch<DocumentationIntegrityReportData>('reports.documentation_integrity', {
        ...fetchOptions,
        params,
      });
      setDocIntegrityReport(data);
    } catch (err) {
      setDocIntegrityError(err instanceof Error ? err.message : 'Could not load documentation integrity report');
      setDocIntegrityReport(null);
    }
  }, [docIntegrityEndDate, fetchOptions, facilityId, visitDate]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (activeTab === 'scheduling') {
      void loadScheduling();
    }
  }, [activeTab, loadScheduling]);

  useEffect(() => {
    if (activeTab === 'ancillary') {
      void loadAncillary();
    }
  }, [activeTab, ancillaryEndDate, loadAncillary]);

  useEffect(() => {
    if (activeTab === 'documentation_integrity') {
      void loadDocIntegrity();
    }
  }, [activeTab, docIntegrityEndDate, loadDocIntegrity]);

  useInterval(
    () => { void loadReport(); },
    activeTab === 'open' ? POLL_MS : null
  );

  const handleDateChange = useCallback((date: string) => {
    setVisitDate(date);
    setAncillaryEndDate((prev) => (prev < date ? date : prev));
    setDocIntegrityEndDate((prev) => (prev < date ? date : prev));
    if (!syncUrl) return;
    const url = new URL(window.location.href);
    url.searchParams.set('date', date);
    window.history.replaceState({}, '', url.toString());
  }, [syncUrl]);

  const handleTabChange = useCallback((tab: ReportTabId) => {
    setActiveTab(tab);
    if (syncUrl) {
      const url = new URL(window.location.href);
      if (tab !== 'visits') {
        url.searchParams.set('tab', tab);
      } else {
        url.searchParams.delete('tab');
      }
      window.history.replaceState({}, '', url.toString());
    }
    if (tab === 'open') {
      void loadReport();
    }
  }, [loadReport, syncUrl]);

  const handleRefresh = useCallback(() => {
    void loadReport();
  }, [loadReport]);

  const handleRunReconciliation = useCallback(async () => {
    setReconRunning(true);
    setReconError(null);
    try {
      const body: Record<string, unknown> = { run_date: visitDate };
      const id = Number(facilityId ?? 0);
      if (id > 0) body.facility_id = id;
      await oeFetch('admin.reconciliation.run', {
        ...fetchOptions,
        method: 'POST',
        json: body,
      });
      await loadReport();
    } catch (err) {
      setReconError(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setReconRunning(false);
    }
  }, [fetchOptions, facilityId, loadReport, visitDate]);

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
    <div className={deskCalloutClass('error')}>{loadError}</div>
  ) : null;

  const tabContent = loading && !lastUpdated ? (
    <div className="text-[var(--oe-nc-text-muted)]"><em>Loading report…</em></div>
  ) : (
    <>
      {activeTab === 'visits' && <VisitsSection visits={report.visits} />}
      {activeTab === 'scheduling' && (
        schedulingError
          ? <div className={deskCalloutClass('error')}>{schedulingError}</div>
          : schedulingReport
            ? (
              <SchedulingSection
                data={schedulingReport}
                visitDate={visitDate}
              />
            )
            : <div className="text-[var(--oe-nc-text-muted)]"><em>Loading scheduling report…</em></div>
      )}
      {activeTab === 'ancillary' && (
        ancillaryError
          ? <div className={deskCalloutClass('error')}>{ancillaryError}</div>
          : ancillaryReport
            ? (
              <AncillarySection
                data={ancillaryReport}
                ajaxUrl={ajaxUrl}
                facilityId={facilityId}
                startDate={visitDate}
                endDate={ancillaryEndDate}
                onEndDateChange={setAncillaryEndDate}
              />
            )
            : <div className="text-[var(--oe-nc-text-muted)]"><em>Loading ancillary report…</em></div>
      )}
      {activeTab === 'documentation_integrity' && (
        docIntegrityError
          ? <div className={deskCalloutClass('error')}>{docIntegrityError}</div>
          : docIntegrityReport
            ? (
              <DocumentationIntegritySection
                data={docIntegrityReport}
                ajaxUrl={ajaxUrl}
                facilityId={facilityId}
                startDate={visitDate}
                endDate={docIntegrityEndDate}
                onEndDateChange={setDocIntegrityEndDate}
              />
            )
            : <div className="text-[var(--oe-nc-text-muted)]"><em>Loading documentation integrity report…</em></div>
      )}
      {activeTab === 'cash' && <CashSection cash={report.cash} />}
      {activeTab === 'reconciliation' && (
        <ReconciliationSection
          reconciliation={report.reconciliation}
          canRun={canRunReconciliation}
          running={reconRunning}
          runError={reconError}
          onRun={() => { void handleRunReconciliation(); }}
        />
      )}
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
      <SegmentedControl
        className="nc-daily-reports-tabs"
        ariaLabel="Daily report sections"
        segments={visibleTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        value={activeTab}
        onChange={(tabId) => {
          if (isReportTabId(tabId)) {
            handleTabChange(tabId);
          }
        }}
      />

      <div className="nc-daily-reports-content">
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
