import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { useInterval } from '@core/useInterval';
import { localDateString } from '@islands/daily-reports/reportsFormatters';
import { AccessionModal } from './AccessionModal';
import { LabOpsResultDrawer } from './LabOpsResultDrawer';
import { LabOpsSetupPanel } from './LabOpsSetupPanel';
import { LabOpsWorklist } from './LabOpsWorklist';
import type {
  FulfillmentFilter,
  LabOpsHubProps,
  LabOpsTab,
  SetupStatus,
  WorklistCounts,
  WorklistData,
  WorklistRow,
} from './labOpsTypes';
import { LAB_OPS_POLL_MS } from './labOpsTypes';
import { useLabOpsPageHeading } from './useLabOpsPageHeading';

const EMPTY_COUNTS: WorklistCounts = { pending: 0, in_progress: 0, send_out: 0 };

function initialTab(value: string): LabOpsTab {
  if (value === 'in_progress' || value === 'send_out') return value;
  return 'pending';
}

function initialDate(): string {
  const fromUrl = new URL(window.location.href).searchParams.get('date');
  if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) return fromUrl;
  return localDateString();
}

export function LabOpsHub({
  ajaxUrl,
  csrfToken,
  facilityId,
  initialTab: initialTabProp,
  canEnter,
  canRelease,
  canManageCatalog,
}: LabOpsHubProps) {
  const [tab, setTab] = useState<LabOpsTab>(() => initialTab(initialTabProp));
  const [date, setDate] = useState(initialDate);
  const [fulfillment, setFulfillment] = useState<FulfillmentFilter>('all');
  const [urgentFirst, setUrgentFirst] = useState(true);
  const [rows, setRows] = useState<WorklistRow[]>([]);
  const [counts, setCounts] = useState<WorklistCounts>(EMPTY_COUNTS);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [collectOrderId, setCollectOrderId] = useState<number | null>(null);
  const [accession, setAccession] = useState('');
  const [collectSubmitting, setCollectSubmitting] = useState(false);

  const [drawerOrderId, setDrawerOrderId] = useState<number | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const loadWorklist = useCallback(async () => {
    setLoadError(null);
    try {
      const facility = Number(facilityId ?? 0);
      const body: Record<string, unknown> = {
        tab,
        date,
        fulfillment,
        urgent_first: urgentFirst,
      };
      if (facility > 0) body.facility_id = facility;

      const data = await oeFetch<WorklistData>('lab_ops.worklist', {
        ...fetchOptions,
        json: body,
      });
      setRows(data.rows ?? []);
      setCounts(data.counts ?? EMPTY_COUNTS);
      setLastUpdated(data.last_updated ? new Date(data.last_updated) : new Date());
    } catch {
      setLoadError('Refresh failed');
    }
  }, [date, facilityId, fetchOptions, fulfillment, tab, urgentFirst]);

  const loadSetupStatus = useCallback(async () => {
    if (!canManageCatalog) return;
    try {
      const data = await oeFetch<SetupStatus>('lab_ops.setup_status', fetchOptions);
      setSetup(data);
    } catch {
      /* non-fatal */
    }
  }, [canManageCatalog, fetchOptions]);

  useEffect(() => {
    void loadWorklist();
  }, [loadWorklist]);

  useEffect(() => {
    void loadSetupStatus();
  }, [loadSetupStatus]);

  useInterval(() => {
    void loadWorklist();
  }, LAB_OPS_POLL_MS);

  useLabOpsPageHeading({
    tab,
    counts,
    date,
    fulfillment,
    urgentFirst,
    lastUpdated,
    onTabChange: setTab,
    onDateChange: setDate,
    onFulfillmentChange: setFulfillment,
    onUrgentFirstChange: setUrgentFirst,
    onRefresh: () => {
      void loadWorklist();
    },
  });

  const confirmCollect = useCallback(async () => {
    if (!collectOrderId) return;
    setCollectSubmitting(true);
    try {
      await oeFetch('lab_ops.specimen_collect', {
        ...fetchOptions,
        json: {
          procedure_order_id: collectOrderId,
          accession_no: accession.trim(),
        },
      });
      setCollectOrderId(null);
      setAccession('');
      await loadWorklist();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not mark collected');
    } finally {
      setCollectSubmitting(false);
    }
  }, [accession, collectOrderId, fetchOptions, loadWorklist]);

  const markSendOut = useCallback(async (orderId: number) => {
    try {
      await oeFetch('lab_ops.mark_send_out', {
        ...fetchOptions,
        json: { procedure_order_id: orderId },
      });
      await loadWorklist();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not mark send-out');
    }
  }, [fetchOptions, loadWorklist]);

  return (
    <div id="nc-lab-ops-hub" className="oe-nc-labops">
      {canManageCatalog ? (
        <div id="nc-labops-setup">
          <LabOpsSetupPanel
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            setup={setup}
            onSetupChange={setSetup}
          />
        </div>
      ) : null}

      {loadError ? (
        <div className="alert alert-warning py-2 small mb-2" role="status">{loadError}</div>
      ) : null}

      <LabOpsWorklist
        tab={tab}
        rows={rows}
        canEnter={canEnter}
        onCollect={(orderId) => {
          setCollectOrderId(orderId);
          setAccession('');
        }}
        onEnter={setDrawerOrderId}
        onSendOut={(orderId) => void markSendOut(orderId)}
      />

      <AccessionModal
        open={collectOrderId !== null}
        accession={accession}
        submitting={collectSubmitting}
        onAccessionChange={setAccession}
        onConfirm={() => void confirmCollect()}
        onClose={() => {
          setCollectOrderId(null);
          setAccession('');
        }}
      />

      <LabOpsResultDrawer
        open={drawerOrderId !== null}
        orderId={drawerOrderId}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        canEnter={canEnter}
        canRelease={canRelease}
        onClose={() => setDrawerOrderId(null)}
        onSaved={() => {
          void loadWorklist();
        }}
      />
    </div>
  );
}
