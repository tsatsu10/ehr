import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { oeFetch } from '@core/oeFetch';
import { useInterval } from '@core/useInterval';
import { localDateString } from '@islands/daily-reports/reportsFormatters';
import { PharmOpsWorklist } from './PharmOpsWorklist';
import { PharmOpsSetupPanel } from './PharmOpsSetupPanel';
import { PharmOpsReportsPane } from './PharmOpsReportsPane';
import { PharmOpsInventoryBrowser } from './PharmOpsInventoryBrowser';
import type {
  DestroyLotContext,
  PharmOpsHubProps,
  PharmOpsTab,
  PharmOpsWorklistRow,
  PharmSetupStatus,
  ReceiveInitialContext,
  WorklistCounts,
  WorklistData,
} from './pharmOpsTypes';
import { PHARM_OPS_POLL_MS } from './pharmOpsTypes';
import { usePharmOpsPageHeading } from './usePharmOpsPageHeading';
import { printRxWithNotice } from './pharmOpsPrintRx';

const PharmOpsDispenseDrawer = lazy(() =>
  import('./PharmOpsDispenseDrawer').then((module) => ({
    default: module.PharmOpsDispenseDrawer,
  }))
);

const PharmOpsOtcSaleDrawer = lazy(() =>
  import('./PharmOpsOtcSaleDrawer').then((module) => ({
    default: module.PharmOpsOtcSaleDrawer,
  }))
);

const PharmOpsReceiveDrawer = lazy(() =>
  import('./PharmOpsReceiveDrawer').then((module) => ({
    default: module.PharmOpsReceiveDrawer,
  }))
);

const PharmOpsDestroyDrawer = lazy(() =>
  import('./PharmOpsDestroyDrawer').then((module) => ({
    default: module.PharmOpsDestroyDrawer,
  }))
);

const EMPTY_COUNTS: WorklistCounts = { pending_dispense: 0, low_stock: 0, write_off: 0 };

function initialTab(value: string): PharmOpsTab {
  if (
    value === 'low_stock'
    || value === 'reports'
    || value === 'write_off'
    || value === 'inventory'
  ) {
    return value;
  }
  return 'pending_dispense';
}

function initialDate(): string {
  const fromUrl = new URL(window.location.href).searchParams.get('date');
  if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) return fromUrl;
  return localDateString();
}

export function PharmOpsHub({
  ajaxUrl,
  csrfToken,
  facilityId,
  initialTab: initialTabProp,
  canDispense,
  canReceive = false,
  canDestroy = false,
  canManageCatalog = false,
  canViewReports = true,
}: PharmOpsHubProps) {
  const [tab, setTab] = useState<PharmOpsTab>(() => initialTab(initialTabProp));
  const [date, setDate] = useState(initialDate);
  const [urgentFirst, setUrgentFirst] = useState(true);
  const [rows, setRows] = useState<PharmOpsWorklistRow[]>([]);
  const [counts, setCounts] = useState<WorklistCounts>(EMPTY_COUNTS);
  const [expiryWarnDays, setExpiryWarnDays] = useState(90);
  const [canPrintRx, setCanPrintRx] = useState(false);
  const [runtimeCanDispense, setRuntimeCanDispense] = useState(canDispense);
  const [runtimeCanReceive, setRuntimeCanReceive] = useState(canReceive);
  const [runtimeCanDestroy, setRuntimeCanDestroy] = useState(canDestroy);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerPrescriptionId, setDrawerPrescriptionId] = useState<number | null>(null);
  const [otcDrawerOpen, setOtcDrawerOpen] = useState(false);
  const [receiveDrawerOpen, setReceiveDrawerOpen] = useState(false);
  const [receiveContext, setReceiveContext] = useState<ReceiveInitialContext | null>(null);
  const [destroyDrawerOpen, setDestroyDrawerOpen] = useState(false);
  const [destroyContext, setDestroyContext] = useState<DestroyLotContext | null>(null);
  const [setup, setSetup] = useState<PharmSetupStatus | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  useEffect(() => {
    setRuntimeCanDispense(canDispense);
    setRuntimeCanReceive(canReceive);
    setRuntimeCanDestroy(canDestroy);
  }, [canDestroy, canDispense, canReceive]);

  const loadWorklist = useCallback(async () => {
    if (tab === 'reports') {
      setLoading(false);
      return;
    }

    setLoadError(null);
    setLoading(true);
    try {
      const facility = Number(facilityId ?? 0);
      const body: Record<string, unknown> = {
        tab,
        date,
        filters: { urgent_first: urgentFirst },
      };
      if (facility > 0) body.facility_id = facility;

      const data = await oeFetch<WorklistData>('pharm_ops.worklist', {
        ...fetchOptions,
        json: body,
      });
      setRows(data.rows ?? []);
      setCounts(data.counts ?? EMPTY_COUNTS);
      if (typeof data.expiry_warn_days === 'number') {
        setExpiryWarnDays(data.expiry_warn_days);
      }
      setCanPrintRx(!!data.can_print_rx);
      if (typeof data.can_dispense === 'boolean') {
        setRuntimeCanDispense(data.can_dispense);
      }
      if (typeof data.can_receive === 'boolean') {
        setRuntimeCanReceive(data.can_receive);
      }
      if (typeof data.can_destroy === 'boolean') {
        setRuntimeCanDestroy(data.can_destroy);
      }
      setLastUpdated(data.last_updated ? new Date(data.last_updated) : new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refresh failed';
      setLoadError(message);
      setRows([]);
      setCounts(EMPTY_COUNTS);
    } finally {
      setLoading(false);
    }
  }, [date, facilityId, fetchOptions, tab, urgentFirst]);

  const loadSetupStatus = useCallback(async () => {
    if (!canManageCatalog) return;
    try {
      setSetupError(null);
      const data = await oeFetch<PharmSetupStatus>('pharm_ops.setup_status', fetchOptions);
      setSetup(data);
      if (!data.has_starter_formulary || (data.warehouse_count ?? 0) === 0) {
        setSetupOpen(true);
      }
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not load pharmacy setup status');
    }
  }, [canManageCatalog, fetchOptions]);

  useEffect(() => {
    void loadWorklist();
  }, [loadWorklist]);

  useEffect(() => {
    void loadSetupStatus();
  }, [loadSetupStatus]);

  useInterval(() => {
    if (tab !== 'reports' && tab !== 'inventory') {
      void loadWorklist();
    }
  }, PHARM_OPS_POLL_MS);

  const handlePrintRx = useCallback(async (prescriptionId: number) => {
    setPrintError(null);
    await printRxWithNotice(ajaxUrl, csrfToken, prescriptionId, setPrintError);
  }, [ajaxUrl, csrfToken]);

  const isWorklistTab = tab !== 'reports' && tab !== 'inventory';

  usePharmOpsPageHeading({
    tab,
    counts,
    date,
    urgentFirst,
    lastUpdated,
    canDispense: runtimeCanDispense,
    canReceive: runtimeCanReceive,
    canDestroy: runtimeCanDestroy,
    canManageCatalog,
    canViewReports,
    onTabChange: setTab,
    onDateChange: setDate,
    onUrgentFirstChange: setUrgentFirst,
    onRefresh: () => {
      void loadWorklist();
    },
    onSellOtc: runtimeCanDispense ? () => setOtcDrawerOpen(true) : undefined,
    onReceiveStock: runtimeCanReceive ? () => {
      setReceiveContext(null);
      setReceiveDrawerOpen(true);
    } : undefined,
    onToggleSetup: canManageCatalog ? () => setSetupOpen((open) => !open) : undefined,
  });

  return (
    <div id="nc-pharm-ops-hub" className="nc-pharmops">
      {loadError ? (
        <div className={deskCalloutClass('warn', 'nc-pharmops-alert')} role="alert">
          {loadError}
        </div>
      ) : null}
      {printError ? (
        <div className={deskCalloutClass('warn', 'nc-pharmops-alert')} role="alert">
          {printError}
        </div>
      ) : null}
      {setupError ? (
        <div className={deskCalloutClass('warn', 'nc-pharmops-alert')} role="alert">
          {setupError}
        </div>
      ) : null}
      {canManageCatalog && setupOpen ? (
        <PharmOpsSetupPanel
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          setup={setup}
          onSetupChange={(next) => {
            setSetup(next);
            void loadWorklist();
          }}
        />
      ) : null}
      {tab === 'reports' && canViewReports ? (
        <PharmOpsReportsPane ajaxUrl={ajaxUrl} csrfToken={csrfToken} />
      ) : tab === 'inventory' ? (
        <PharmOpsInventoryBrowser ajaxUrl={ajaxUrl} csrfToken={csrfToken} />
      ) : (
        <PharmOpsWorklist
          tab={tab}
          rows={rows}
          loading={loading && isWorklistTab}
          worklistDate={date}
          expiryWarnDays={expiryWarnDays}
          canDispense={runtimeCanDispense}
          canReceive={runtimeCanReceive}
          canDestroy={runtimeCanDestroy}
          canPrintRx={canPrintRx}
          onDispense={(prescriptionId) => setDrawerPrescriptionId(prescriptionId)}
          onReceive={(drugId, drugName) => {
            setReceiveContext({ drugId, drugName });
            setReceiveDrawerOpen(true);
          }}
          onDestroy={(drugId, inventoryId, drugName, lotNumber) => {
            setDestroyContext({ drugId, inventoryId, drugName, lotNumber });
            setDestroyDrawerOpen(true);
          }}
          onPrintRx={(prescriptionId) => {
            void handlePrintRx(prescriptionId);
          }}
        />
      )}
      {drawerPrescriptionId != null ? (
        <Suspense fallback={null}>
          <PharmOpsDispenseDrawer
            open
            prescriptionId={drawerPrescriptionId}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            canDispense={runtimeCanDispense}
            onClose={() => setDrawerPrescriptionId(null)}
            onDispensed={() => {
              void loadWorklist();
            }}
          />
        </Suspense>
      ) : null}
      {otcDrawerOpen ? (
        <Suspense fallback={null}>
          <PharmOpsOtcSaleDrawer
            open
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            canDispense={runtimeCanDispense}
            onClose={() => setOtcDrawerOpen(false)}
          />
        </Suspense>
      ) : null}
      {receiveDrawerOpen ? (
        <Suspense fallback={null}>
          <PharmOpsReceiveDrawer
            open
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            canReceive={runtimeCanReceive}
            initialContext={receiveContext}
            onClose={() => {
              setReceiveDrawerOpen(false);
              setReceiveContext(null);
            }}
            onReceived={() => {
              void loadWorklist();
            }}
          />
        </Suspense>
      ) : null}
      {destroyDrawerOpen ? (
        <Suspense fallback={null}>
          <PharmOpsDestroyDrawer
            open
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            canDestroy={runtimeCanDestroy}
            context={destroyContext}
            onClose={() => {
              setDestroyDrawerOpen(false);
              setDestroyContext(null);
            }}
            onDestroyed={() => {
              void loadWorklist();
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
