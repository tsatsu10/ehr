import { useCallback, useEffect, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { WidgetCard } from '@components/WidgetCard';
import { SegmentedControl } from '@components/SegmentedControl';
import { Button } from '@components/ui/button';
import { oeFetch } from '@core/oeFetch';
import { ChartBanner } from './ChartBanner';
import { ChartInChartSearch } from './ChartInChartSearch';
import { ClinicalTab } from './ClinicalTab';
import { MessagesTab } from './MessagesTab';
import { OverviewTab } from './OverviewTab';
import { ProfileTab } from './ProfileTab';
import {
  CHART_TAB_IDS,
  type ActivityFeedResponse,
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
  visitIdFilter = 0,
  visitBoardUrl,
  frontDeskUrl,
  exportChartUrl,
  registrationMode,
  enableInChartPatientSearch = false,
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
  const [canExtendLookback, setCanExtendLookback] = useState(false);
  const [olderHistoryMessage, setOlderHistoryMessage] = useState<string | null>(null);

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
  const [pendingClinicalAnchor, setPendingClinicalAnchor] = useState(clinicalAnchor ?? '');

  const applyActivityFeed = useCallback((feed: ActivityFeedResponse) => {
    setActivityItems(feed.items ?? []);
    setActivityOffset((feed.items ?? []).length);
    setActivityHasMore(!!feed.has_more);
    setLookbackDays(feed.lookback_days ?? 90);
    setCanExtendLookback(!!feed.can_extend_lookback);
    setOlderHistoryMessage(feed.older_history_message ?? null);
  }, []);

  const fetchActivityFeed = useCallback(
    async (offset: number, lookback: number) => {
      const params: Record<string, number> = { pid, offset, lookback_days: lookback };
      if (visitIdFilter > 0) {
        params.visit_id = visitIdFilter;
      }

      return oeFetch<ActivityFeedResponse>('patients.chart.activity_feed', {
        ...fetchOptions,
        params,
      });
    },
    [fetchOptions, pid, visitIdFilter]
  );

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

      if (visitIdFilter > 0) {
        const feed = await fetchActivityFeed(0, data.activity_feed?.lookback_days ?? 90);
        applyActivityFeed(feed);
      } else {
        applyActivityFeed(data.activity_feed ?? {});
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not load chart.');
    } finally {
      setPreviewLoading(false);
    }
  }, [applyActivityFeed, fetchActivityFeed, fetchOptions, pid, visitIdFilter]);

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
      if (canExtendLookback) {
        const feed = await fetchActivityFeed(0, 365);
        applyActivityFeed(feed);
        return;
      }

      const feed = await fetchActivityFeed(activityOffset, lookbackDays);
      const newItems = feed.items ?? [];
      setActivityItems((prev) => [...prev, ...newItems]);
      setActivityOffset((prev) => prev + newItems.length);
      setActivityHasMore(!!feed.has_more);
      setCanExtendLookback(!!feed.can_extend_lookback);
      setOlderHistoryMessage(feed.older_history_message ?? null);
    } finally {
      setActivityLoadingMore(false);
    }
  }, [
    activityOffset,
    applyActivityFeed,
    canExtendLookback,
    fetchActivityFeed,
    lookbackDays,
  ]);

  const scrollToClinicalAnchor = useCallback((anchor: string) => {
    if (!anchor) return;
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const scrollToProfileAnchor = useCallback((anchor: string) => {
    if (anchor === 'profile-payments') {
      const el = document.getElementById('nc-profile-payments-strip-panel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  const handleTabChange = useCallback(
    (tab: ChartTabId, anchor?: string) => {
      setActiveTab(tab);
      const nextAnchor = tab === 'clinical' ? (anchor ?? pendingClinicalAnchor) : '';
      if (tab === 'clinical' && anchor) {
        setPendingClinicalAnchor(anchor);
      } else if (tab !== 'clinical') {
        setPendingClinicalAnchor('');
      }

      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      if (tab === 'clinical' && nextAnchor) {
        url.searchParams.set('anchor', nextAnchor);
      } else {
        url.searchParams.delete('anchor');
      }
      window.history.replaceState({}, '', url.toString());

      if (tab === 'visits' && !visitsLoaded) {
        void loadVisits(true);
      }
      if (tab === 'clinical' && !clinicalLoaded) {
        void loadClinical().then(() => {
          if (nextAnchor) {
            scrollToClinicalAnchor(nextAnchor);
          }
        });
      } else if (tab === 'clinical' && nextAnchor) {
        scrollToClinicalAnchor(nextAnchor);
      }
      if (tab === 'profile') {
        const scrollProfile = () => {
          if (anchor) {
            scrollToProfileAnchor(anchor);
          }
        };
        if (!paymentsLoaded) {
          void loadPaymentsStrip().then(scrollProfile);
        } else {
          scrollProfile();
        }
      }
      if (tab === 'messages' && !messagesLoaded) {
        void loadMessages(true);
      }
    },
    [
      clinicalLoaded,
      loadClinical,
      loadMessages,
      loadPaymentsStrip,
      loadVisits,
      messagesLoaded,
      paymentsLoaded,
      pendingClinicalAnchor,
      scrollToClinicalAnchor,
      scrollToProfileAnchor,
      visitsLoaded,
    ]
  );

  const navigateToChartSection = useCallback(
    (tab: ChartTabId, anchor?: string) => {
      handleTabChange(tab, anchor);
    },
    [handleTabChange]
  );

  const handleProfileSaved = useCallback(() => {
    setClinicalLoaded(false);
    setPaymentsLoaded(false);
    setVisitsLoaded(false);
    void reloadContext();
    void reloadChecklist();
  }, [reloadChecklist, reloadContext]);

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

  useEffect(() => {
    if (activeTab !== 'overview' || !preview?.active_visit?.visit_id) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      void reloadContext();
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeTab, preview?.active_visit?.visit_id, reloadContext]);

  return (
    <div className="nc-patient-chart" id="nc-patient-chart" data-pid={pid}>
      <WidgetCard
        className="mb-3"
        title="Patient chart"
        headerClassName="flex justify-between items-center flex-wrap"
        bodyPad="pad"
        actions={(
          <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
            {exportChartUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={exportChartUrl} target="_top">
                  Export chart
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={frontDeskUrl} target="_top">
                Front Desk
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={visitBoardUrl} target="_top">
                Visit Board
              </a>
            </Button>
          </div>
        )}
      >
        <div id="nc-chart-banner" className="mb-3">
          {previewLoading && !preview && <em>Loading patient…</em>}
          {previewError && <div className={deskCalloutClass('error')}>{previewError}</div>}
          {preview && <ChartBanner preview={preview} />}
        </div>

        {enableInChartPatientSearch && (
          <ChartInChartSearch
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            pid={pid}
            onNavigate={navigateToChartSection}
          />
        )}

        <div id="nc-chart-tabs">
          <SegmentedControl
            segments={CHART_TAB_IDS.map((tab) => ({ id: tab, label: TAB_LABELS[tab] }))}
            value={activeTab}
            onChange={(id) => {
              handleTabChange(id as ChartTabId);
            }}
            ariaLabel="Chart sections"
            className="mb-3"
          />
        </div>

        <div className="nc-tab-content" id="nc-chart-tab-panes">
          <div
            className={activeTab === 'overview' ? 'nc-tab-pane' : 'nc-tab-pane hidden'}
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
                    olderHistoryMessage={olderHistoryMessage}
                    loadingMore={activityLoadingMore}
                    onEditProfile={() => handleTabChange('profile')}
                    onLoadMoreActivity={() => {
                      void loadMoreActivity();
                    }}
                    onNavigateChartSection={navigateToChartSection}
                  />
                )}
              </>
            )}
          </div>

          <div
            className={activeTab === 'profile' ? 'nc-tab-pane' : 'nc-tab-pane hidden'}
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
            className={activeTab === 'visits' ? 'nc-tab-pane' : 'nc-tab-pane hidden'}
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
            className={activeTab === 'clinical' ? 'nc-tab-pane' : 'nc-tab-pane hidden'}
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
                clinicalAnchor={pendingClinicalAnchor || clinicalAnchor}
                onScrollToAnchor={scrollToClinicalAnchor}
              />
            )}
          </div>

          <div
            className={activeTab === 'messages' ? 'nc-tab-pane' : 'nc-tab-pane hidden'}
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
