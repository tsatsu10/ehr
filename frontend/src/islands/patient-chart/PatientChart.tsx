import { useCallback, useEffect, useMemo, useState } from 'react';
import { WidgetCard } from '@components/WidgetCard';
import { oeFetch } from '@core/oeFetch';
import { ChartBanner } from './ChartBanner';
import { ClinicalTab } from './ClinicalTab';
import { MessagesTab } from './MessagesTab';
import { OverviewTab } from './OverviewTab';
import { ProfileTab } from './ProfileTab';
import {
  CHART_TAB_IDS,
  type ActivityFeedItem,
  type ChartMessagesData,
  type ChartPreview,
  type ChartTabId,
  type ChartVisitsData,
  type ClinicalData,
  type ClinicalLabsStrip,
  type ClinicalMedsStrip,
  type ClinicalReferralsStrip,
  type PatientChartProps,
  type PaymentsStripData,
  type RegistrationGetData,
} from './patientChartTypes';
import { isValidChartTab } from './patientChartUtils';
import { VisitsTab } from './VisitsTab';

const TAB_LABELS: Record<ChartTabId, string> = {
  overview: 'Overview',
  profile: 'Profile',
  visits: 'Visits',
  clinical: 'Clinical',
  messages: 'Messages',
};

export function PatientChart({
  ajaxUrl,
  csrfToken,
  pid,
  activeTab: initialTab,
  clinicalAnchor = '',
  visitBoardUrl,
  frontDeskUrl,
  exportChartUrl,
  registrationMode,
}: PatientChartProps) {
  const [activeTab, setActiveTab] = useState<ChartTabId>(
    isValidChartTab(initialTab) ? initialTab : 'overview'
  );

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const [preview, setPreview] = useState<ChartPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [activityItems, setActivityItems] = useState<ActivityFeedItem[]>([]);
  const [activityOffset, setActivityOffset] = useState(0);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(90);

  const [checklist, setChecklist] = useState<RegistrationGetData | null>(null);
  const [payments, setPayments] = useState<PaymentsStripData | null>(null);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);

  const [visitsData, setVisitsData] = useState<ChartVisitsData | null>(null);
  const [visitsLoaded, setVisitsLoaded] = useState(false);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsLoadingMore, setVisitsLoadingMore] = useState(false);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [pastOffset, setPastOffset] = useState(0);
  const [pastHasMore, setPastHasMore] = useState(false);

  const [clinicalData, setClinicalData] = useState<ClinicalData | null>(null);
  const [clinicalLoaded, setClinicalLoaded] = useState(false);
  const [clinicalLoading, setClinicalLoading] = useState(false);
  const [clinicalError, setClinicalError] = useState<string | null>(null);
  const [referralsStrip, setReferralsStrip] = useState<ClinicalReferralsStrip | null>(null);
  const [labsStrip, setLabsStrip] = useState<ClinicalLabsStrip | null>(null);
  const [medsStrip, setMedsStrip] = useState<ClinicalMedsStrip | null>(null);

  const [messagesData, setMessagesData] = useState<ChartMessagesData | null>(null);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messagesOffset, setMessagesOffset] = useState(0);

  const reloadContext = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await oeFetch<ChartPreview>('patients.preview', {
        ...fetchOptions,
        method: 'POST',
        json: { pid, context: 'patient-chart' },
      });
      setPreview(data);
      const feed = data.activity_feed ?? {};
      setActivityItems(feed.items ?? []);
      setActivityOffset((feed.items ?? []).length);
      setActivityHasMore(!!feed.has_more);
      setLookbackDays(feed.lookback_days ?? 90);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not load chart.');
    } finally {
      setPreviewLoading(false);
    }
  }, [fetchOptions, pid]);

  const reloadChecklist = useCallback(async () => {
    try {
      const data = await oeFetch<RegistrationGetData>('patients.registration.get', {
        ...fetchOptions,
        method: 'POST',
        json: { pid },
      });
      setChecklist(data);
    } catch {
      /* non-fatal */
    }
  }, [fetchOptions, pid]);

  const loadPaymentsStrip = useCallback(async () => {
    try {
      const data = await oeFetch<PaymentsStripData>('mrd.profile_payments_summary', {
        ...fetchOptions,
        params: { pid },
      });
      setPayments(data);
      setPaymentsLoaded(true);
    } catch {
      setPayments(null);
      setPaymentsLoaded(true);
    }
  }, [fetchOptions, pid]);

  const loadVisits = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setVisitsLoading(true);
        setVisitsError(null);
        setPastOffset(0);
      } else {
        setVisitsLoadingMore(true);
      }

      try {
        const offset = reset ? 0 : pastOffset;
        const data = await oeFetch<ChartVisitsData>('patients.chart.visits', {
          ...fetchOptions,
          params: { pid, offset },
        });

        if (reset) {
          setVisitsData(data);
          setVisitsLoaded(true);
        } else {
          setVisitsData((prev) => ({
            ...data,
            today_visits: prev?.today_visits ?? data.today_visits,
            past_visits: [...(prev?.past_visits ?? []), ...(data.past_visits ?? [])],
          }));
        }

        setPastHasMore(!!data.past_has_more);
        setPastOffset((data.past_offset ?? 0) + (data.past_visits ?? []).length);
      } catch (err) {
        if (reset) {
          setVisitsError(err instanceof Error ? err.message : 'Could not load visits.');
        }
      } finally {
        setVisitsLoading(false);
        setVisitsLoadingMore(false);
      }
    },
    [fetchOptions, pastOffset, pid]
  );

  const loadClinicalStrips = useCallback(
    async (encounterId: number | null | undefined) => {
      const encParam =
        encounterId != null ? { encounter_id: encounterId } : ({} as Record<string, number>);

      const baseParams = { pid, ...encParam };

      const [refs, labs, meds] = await Promise.all([
        oeFetch<ClinicalReferralsStrip>('mrd.clinical_referrals_strip', {
          ...fetchOptions,
          params: baseParams,
        }).catch(() => null),
        oeFetch<ClinicalLabsStrip>('mrd.clinical_labs_summary', {
          ...fetchOptions,
          params: baseParams,
        }).catch(() => null),
        oeFetch<ClinicalMedsStrip>('mrd.clinical_meds_summary', {
          ...fetchOptions,
          params: baseParams,
        }).catch(() => null),
      ]);

      if (refs) setReferralsStrip(refs);
      if (labs) setLabsStrip(labs);
      if (meds) setMedsStrip(meds);
    },
    [fetchOptions, pid]
  );

  const loadClinical = useCallback(async () => {
    setClinicalLoading(true);
    setClinicalError(null);
    try {
      const data = await oeFetch<ClinicalData>('patients.chart.clinical', {
        ...fetchOptions,
        params: { pid },
      });
      setClinicalData(data);
      setClinicalLoaded(true);
      await loadClinicalStrips(data.active_encounter_id);
    } catch (err) {
      setClinicalError(err instanceof Error ? err.message : 'Could not load clinical summary.');
    } finally {
      setClinicalLoading(false);
    }
  }, [fetchOptions, loadClinicalStrips, pid]);

  const loadMessages = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setMessagesLoading(true);
        setMessagesError(null);
        setMessagesOffset(0);
      } else {
        setMessagesLoadingMore(true);
      }

      try {
        const offset = reset ? 0 : messagesOffset;
        const data = await oeFetch<ChartMessagesData>('patients.chart.messages', {
          ...fetchOptions,
          params: { pid, offset },
        });

        if (reset) {
          setMessagesData(data);
          setMessagesLoaded(true);
        } else {
          setMessagesData((prev) => ({
            ...data,
            messages: [...(prev?.messages ?? []), ...(data.messages ?? [])],
            reminders: prev?.reminders ?? data.reminders,
          }));
        }

        setMessagesOffset((data.offset ?? 0) + (data.messages ?? []).length);
      } catch (err) {
        if (reset) {
          setMessagesError(err instanceof Error ? err.message : 'Could not load messages.');
        }
      } finally {
        setMessagesLoading(false);
        setMessagesLoadingMore(false);
      }
    },
    [fetchOptions, messagesOffset, pid]
  );

  const loadMoreActivity = useCallback(async () => {
    setActivityLoadingMore(true);
    try {
      const feed = await oeFetch<{ items?: ActivityFeedItem[]; has_more?: boolean }>(
        'patients.chart.activity_feed',
        { ...fetchOptions, params: { pid, offset: activityOffset } }
      );
      const newItems = feed.items ?? [];
      setActivityItems((prev) => [...prev, ...newItems]);
      setActivityOffset((prev) => prev + newItems.length);
      setActivityHasMore(!!feed.has_more);
    } finally {
      setActivityLoadingMore(false);
    }
  }, [activityOffset, fetchOptions, pid]);

  const handleTabChange = useCallback(
    (tab: ChartTabId) => {
      setActiveTab(tab);

      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      if (tab === 'clinical' && clinicalAnchor) {
        url.searchParams.set('anchor', clinicalAnchor);
      } else {
        url.searchParams.delete('anchor');
      }
      window.history.replaceState({}, '', url.toString());

      if (tab === 'visits' && !visitsLoaded) {
        void loadVisits(true);
      }
      if (tab === 'clinical' && !clinicalLoaded) {
        void loadClinical();
      }
      if (tab === 'profile' && !paymentsLoaded) {
        void loadPaymentsStrip();
      }
      if (tab === 'messages' && !messagesLoaded) {
        void loadMessages(true);
      }
    },
    [
      clinicalAnchor,
      clinicalLoaded,
      loadClinical,
      loadMessages,
      loadPaymentsStrip,
      loadVisits,
      messagesLoaded,
      paymentsLoaded,
      visitsLoaded,
    ]
  );

  const handleProfileSaved = useCallback(() => {
    setClinicalLoaded(false);
    setPaymentsLoaded(false);
    setVisitsLoaded(false);
    void reloadContext();
    void reloadChecklist();
  }, [reloadChecklist, reloadContext]);

  const scrollToClinicalAnchor = useCallback((anchor: string) => {
    if (!anchor) return;
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    void reloadContext();
    void reloadChecklist();
  }, [reloadChecklist, reloadContext]);

  useEffect(() => {
    if (activeTab === 'profile' && !paymentsLoaded) {
      void loadPaymentsStrip();
    }
  }, [activeTab, loadPaymentsStrip, paymentsLoaded]);

  useEffect(() => {
    if (activeTab === 'visits' && !visitsLoaded) {
      void loadVisits(true);
    }
  }, [activeTab, loadVisits, visitsLoaded]);

  useEffect(() => {
    if (activeTab === 'clinical' && !clinicalLoaded) {
      void loadClinical();
    }
  }, [activeTab, clinicalLoaded, loadClinical]);

  useEffect(() => {
    if (activeTab === 'messages' && !messagesLoaded) {
      void loadMessages(true);
    }
  }, [activeTab, loadMessages, messagesLoaded]);

  return (
    <div className="oe-nc-patient-chart" id="nc-patient-chart" data-pid={pid}>
      <WidgetCard
        className="mb-3"
        title={<h2 className="oe-nc-widget-card__title mb-0">Patient chart</h2>}
        headerClassName="d-flex justify-content-between align-items-center flex-wrap"
        bodyPad="pad"
        actions={(
          <div className="btn-group btn-group-sm mt-2 mt-md-0">
            {exportChartUrl && (
              <a href={exportChartUrl} className="btn btn-outline-secondary" target="_top">
                Export chart
              </a>
            )}
            <a href={frontDeskUrl} className="btn btn-outline-secondary" target="_top">
              Front Desk
            </a>
            <a href={visitBoardUrl} className="btn btn-outline-primary" target="_top">
              Visit Board
            </a>
          </div>
        )}
      >
        <div id="nc-chart-banner" className="mb-3">
          {previewLoading && !preview && <em>Loading patient…</em>}
          {previewError && <div className="alert alert-danger">{previewError}</div>}
          {preview && <ChartBanner preview={preview} />}
        </div>

        <ul className="nav nav-tabs mb-3" id="nc-chart-tabs" role="tablist">
          {CHART_TAB_IDS.map((tab) => (
            <li key={tab} className="nav-item" role="presentation">
              <button
                type="button"
                className={`nav-link${activeTab === tab ? ' active' : ''}`}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`nc-chart-tab-${tab}`}
                onClick={() => handleTabChange(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            </li>
          ))}
        </ul>

        <div className="tab-content" id="nc-chart-tab-panes">
          <div
            className={`tab-pane fade${activeTab === 'overview' ? ' show active' : ''}`}
            id="nc-chart-tab-overview"
            role="tabpanel"
          >
            {activeTab === 'overview' && (
              <>
                {previewLoading && !preview && <em>Loading overview…</em>}
                {preview && (
                  <OverviewTab
                    preview={preview}
                    visitBoardUrl={visitBoardUrl}
                    activityItems={activityItems}
                    activityHasMore={activityHasMore}
                    lookbackDays={lookbackDays}
                    loadingMore={activityLoadingMore}
                    onEditProfile={() => handleTabChange('profile')}
                    onLoadMoreActivity={() => {
                      void loadMoreActivity();
                    }}
                  />
                )}
              </>
            )}
          </div>

          <div
            className={`tab-pane fade${activeTab === 'profile' ? ' show active' : ''}`}
            id="nc-chart-tab-profile"
            role="tabpanel"
          >
            {activeTab === 'profile' && (
              <ProfileTab
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                pid={pid}
                registrationMode={registrationMode}
                checklist={checklist}
                payments={payments}
                onProfileSaved={handleProfileSaved}
              />
            )}
          </div>

          <div
            className={`tab-pane fade${activeTab === 'visits' ? ' show active' : ''}`}
            id="nc-chart-tab-visits"
            role="tabpanel"
          >
            {activeTab === 'visits' && (
              <VisitsTab
                todayVisits={visitsData?.today_visits ?? []}
                pastVisits={visitsData?.past_visits ?? []}
                pastHasMore={pastHasMore}
                loading={visitsLoading && !visitsData}
                loadingMore={visitsLoadingMore}
                error={visitsError}
                visitBoardUrl={visitBoardUrl}
                onLoadMore={() => {
                  void loadVisits(false);
                }}
              />
            )}
          </div>

          <div
            className={`tab-pane fade${activeTab === 'clinical' ? ' show active' : ''}`}
            id="nc-chart-tab-clinical"
            role="tabpanel"
          >
            {activeTab === 'clinical' && (
              <ClinicalTab
                data={clinicalData}
                referralsStrip={referralsStrip}
                labsStrip={labsStrip}
                medsStrip={medsStrip}
                loading={clinicalLoading && !clinicalData}
                error={clinicalError}
                clinicalAnchor={clinicalAnchor}
                onScrollToAnchor={scrollToClinicalAnchor}
              />
            )}
          </div>

          <div
            className={`tab-pane fade${activeTab === 'messages' ? ' show active' : ''}`}
            id="nc-chart-tab-messages"
            role="tabpanel"
          >
            {activeTab === 'messages' && (
              <MessagesTab
                data={messagesData}
                loading={messagesLoading && !messagesData}
                loadingMore={messagesLoadingMore}
                error={messagesError}
                onLoadMore={() => {
                  void loadMessages(false);
                }}
              />
            )}
          </div>
        </div>
      </WidgetCard>
    </div>
  );
}
