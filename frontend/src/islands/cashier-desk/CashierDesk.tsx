/**
 * CashierDesk — Phase 4A/4B React island replacing jQuery NewClinicCashier.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { oeFetch } from '@core/oeFetch';
import { resolveActionConflict, type DeskInterrupt } from '@core/deskConflict';
import { useInterval } from '@core/useInterval';
import { useQueueVisibilityRefresh } from '@core/useQueueVisibilityRefresh';
import { usePageHeadingToolbar } from '@core/usePageHeadingToolbar';
import { getDeskActiveVisitId, clearDeskActiveVisitId } from '@core/deskSessionStorage';
import { useSharedDeviceSession } from '@core/useSharedDeviceSession';
import { DeskInterruptBanner } from '@components/DeskInterruptBanner';
import { DeskSharedDeviceBanner } from '@components/DeskSharedDeviceBanner';
import { DeskQueueStatusBar } from '@components/DeskQueueStatusBar';
import { QueueTruncationBanner } from '@components/QueueTruncationBanner';
import type {
  CashierCoverageLine,
  CashierDeskProps,
  CashierPaymentMethod,
  CashierPayResult,
  CashierQueueCard,
  CashierQueueData,
  CashierResolveData,
  CashierSelectData,
  CashierSignMeta,
  CashierStagedLine,
} from '@core/types';
import { CashierQueue } from './CashierQueue';
import { CashierActivePane, type CashierActiveMode } from './CashierActivePane';
import { CashierDeskLayout } from './cashierDeskUi';
import { CashierMobileQueueBar, CashierMobileQueueSheet } from './CashierMobileQueueSheet';
import { PayConfirmModal } from './PayConfirmModal';
import { PartialPayModal } from './PartialPayModal';
import { SchemeSplitModal } from './SchemeSplitModal';
import { ReceiptModal } from './ReceiptModal';
import { CloseZeroModal } from './CloseZeroModal';
import { DiscountConfirmModal } from './DiscountConfirmModal';
import { EsignOverrideModal } from '@components/EsignOverrideModal';
import { PickVisitModal } from './PickVisitModal';
import { MarkUnpaidModal } from './MarkUnpaidModal';
import { postCashierAction } from './postCashierAction';
import {
  buildStagedFromSuggestions,
  getDiscountLines,
  newClientRequestId,
  setCashierCurrencyFormat,
  stagedLinesHaveDiscount,
} from './cashierUtils';
import type { PatientSearchHint } from './PatientSearchPanel';

const STORAGE_KEY = 'cashier_desk_active_visit_id';
const NARROW_DESK_QUERY = '(max-width: 1023px)';

function useNarrowCashierDesk(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_DESK_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW_DESK_QUERY);
    const update = () => setNarrow(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return narrow;
}

function selectToSignMeta(data: CashierSelectData, canEsignOverride: boolean): CashierSignMeta {
  return {
    encounter_signed: data.encounter_signed === true,
    unsigned_message: data.unsigned_message,
    encounter_url: data.encounter_url,
    can_esign_override: data.can_esign_override ?? canEsignOverride,
  };
}

function mergeSelectData(
  data: CashierSelectData,
  canSkipCompletion: boolean,
  canApplyDiscount: boolean,
): CashierSelectData {
  return {
    ...data,
    can_skip_completion: data.can_skip_completion || canSkipCompletion,
    can_apply_discount: data.can_apply_discount ?? canApplyDiscount,
  };
}

export function CashierDesk({
  ajaxUrl,
  csrfToken,
  facilityId,
  pollMs = 30_000,
  visitBoardUrl,
  canMarkUnpaid = false,
  canSkipCompletion = false,
  canApplyDiscount = false,
  canEsignOverride = false,
  enablePartialPayment = false,
  canPartialPay = false,
  enableInsuranceScheme = false,
  sharedDeviceWarning = false,
  currencyFormat,
}: CashierDeskProps) {
  useEffect(() => {
    if (currencyFormat) {
      setCashierCurrencyFormat({
        currency_symbol: currencyFormat.currency_symbol ?? '',
        currency_decimals: currencyFormat.currency_decimals ?? 2,
        currency_symbol_position: currencyFormat.currency_symbol_position === 'after' ? 'after' : 'before',
      });
    }
  }, [currencyFormat]);

  const [cards, setCards] = useState<CashierQueueCard[]>([]);
  const [queueTruncated, setQueueTruncated] = useState(false);
  const [counts, setCounts] = useState<CashierQueueData['counts'] | null>(null);
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [paidToday, setPaidToday] = useState<CashierQueueData['paid_today']>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchHint, setSearchHint] = useState<PatientSearchHint | null>(null);

  const [mode, setMode] = useState<CashierActiveMode>('idle');
  const [selectData, setSelectData] = useState<CashierSelectData | null>(null);
  const [signMeta, setSignMeta] = useState<CashierSignMeta | null>(null);
  const [staged, setStaged] = useState<CashierStagedLine[]>([]);
  const [paneError, setPaneError] = useState<string | null>(null);
  const [interrupt, setInterrupt] = useState<DeskInterrupt | null>(null);
  const [posting, setPosting] = useState(false);

  const [payConfirmOpen, setPayConfirmOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payReceiptNote, setPayReceiptNote] = useState('');
  const [payPaymentMethod, setPayPaymentMethod] = useState<CashierPaymentMethod>('cash');
  const [payMomoReference, setPayMomoReference] = useState('');
  const [payEsignReason, setPayEsignReason] = useState<string | null>(null);
  const [payCompletionReason, setPayCompletionReason] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const clientRequestIdRef = useRef<string | null>(null);

  const [esignOpen, setEsignOpen] = useState(false);
  const [completionOverrideOpen, setCompletionOverrideOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);

  const [pickVisits, setPickVisits] = useState<CashierResolveData['ready_for_payment']>([]);
  const [pickOpen, setPickOpen] = useState(false);

  const [receiptPreview, setReceiptPreview] = useState<CashierSelectData['preview'] | null>(null);
  const [receipt, setReceipt] = useState<CashierPayResult['receipt'] | null>(null);
  const [receiptHistoryUrl, setReceiptHistoryUrl] = useState<string | null>(null);

  const [closeZeroOpen, setCloseZeroOpen] = useState(false);
  const [closeZeroError, setCloseZeroError] = useState<string | null>(null);
  const [closeZeroSubmitting, setCloseZeroSubmitting] = useState(false);

  const [markUnpaidOpen, setMarkUnpaidOpen] = useState(false);
  const [markUnpaidError, setMarkUnpaidError] = useState<string | null>(null);
  const [markUnpaidSubmitting, setMarkUnpaidSubmitting] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialError, setPartialError] = useState<string | null>(null);
  const [partialSubmitting, setPartialSubmitting] = useState(false);
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [schemeError, setSchemeError] = useState<string | null>(null);
  const [schemeSubmitting, setSchemeSubmitting] = useState(false);
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false);
  const narrowDesk = useNarrowCashierDesk();

  const queueSeq = useRef(0);
  const revisionRef = useRef('');
  const activeVisitIdRef = useRef<number | null>(null);
  const modalOpenRef = useRef(false);

  const facilityParams = useMemo(
    () => (facilityId > 0 ? { facility_id: facilityId } : undefined),
    [facilityId],
  );

  const resetActivePane = useCallback(() => {
    setMode('idle');
    setSelectData(null);
    setSignMeta(null);
    setStaged([]);
    setPaneError(null);
    activeVisitIdRef.current = null;
    clearDeskActiveVisitId(STORAGE_KEY);
  }, []);

  const sharedSession = useSharedDeviceSession({
    enabled: sharedDeviceWarning,
    ajaxUrl,
    csrfToken,
    facilityId,
    storageKey: STORAGE_KEY,
    compareMode: 'pid_only',
    onReturnToQueue: resetActivePane,
  });

  const applySelectData = useCallback((data: CashierSelectData) => {
    const merged = mergeSelectData(data, canSkipCompletion, canApplyDiscount);
    setSelectData(merged);
    setSignMeta(selectToSignMeta(merged, canEsignOverride));
    sharedSession.setActiveVisitId(merged.visit.id);
    activeVisitIdRef.current = merged.visit.id;
    setStaged((prev) => {
      if (prev.length > 0) return prev;
      return buildStagedFromSuggestions(merged.suggested_fees ?? [], merged.charges ?? []);
    });
    setMode('checkout');
    setSearchHint(null);
  }, [canApplyDiscount, canEsignOverride, canSkipCompletion, sharedSession]);

  useEffect(() => {
    modalOpenRef.current = esignOpen
      || completionOverrideOpen
      || discountOpen
      || pickOpen
      || payConfirmOpen
      || closeZeroOpen
      || markUnpaidOpen
      || partialOpen
      || schemeOpen
      || mobileQueueOpen
      || receipt !== null;
  }, [
    esignOpen,
    completionOverrideOpen,
    discountOpen,
    pickOpen,
    payConfirmOpen,
    closeZeroOpen,
    markUnpaidOpen,
    partialOpen,
    schemeOpen,
    mobileQueueOpen,
    receipt,
  ]);

  const fetchQueue = useCallback(async () => {
    queueSeq.current += 1;
    const token = queueSeq.current;

    try {
      const data = await oeFetch<CashierQueueData>('cashier.queue', {
        ajaxUrl,
        csrfToken,
        // SCALE-1.8 — send our last revision so an unchanged queue skips the re-render.
        params: revisionRef.current
          ? { ...facilityParams, known_revision: revisionRef.current }
          : facilityParams,
      });

      if (token !== queueSeq.current) return;
      if (data.unchanged) {
        setQueueError(null);
        setLastUpdated(new Date());
        return;
      }
      revisionRef.current = data.revision ?? '';

      setCards(data.visits ?? []);
      setCounts(data.counts ?? null);
      setQueueTruncated(!!data.queue_truncated);
      setVisitDate(data.visit_date ?? null);
      setPaidToday(data.paid_today ?? []);
      setQueueError(null);
      setLastUpdated(new Date());

      const activeId = activeVisitIdRef.current;
      if (activeId) {
        const match = (data.visits ?? []).find((c) => c.id === activeId);
        if (match?.row_version != null) {
          setSelectData((prev) =>
            prev && prev.visit.id === activeId
              ? { ...prev, visit: { ...prev.visit, row_version: match.row_version } }
              : prev
          );
        }
        if (!match && !modalOpenRef.current) resetActivePane();
      }
    } catch (err) {
      if (token !== queueSeq.current) return;
      setQueueError(err instanceof Error ? err.message : 'Queue load failed');
    } finally {
      if (token === queueSeq.current) setQueueLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityParams, resetActivePane]);

  const fetchQueueRef = useRef(fetchQueue);
  useEffect(() => {
    fetchQueueRef.current = fetchQueue;
  }, [fetchQueue]);

  const selectVisit = useCallback(async (visitId: number) => {
    if (sharedSession.blocked) return;

    setMode('loading');
    setPaneError(null);
    setInterrupt(null);

    try {
      const data = await oeFetch<CashierSelectData>('cashier.select', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId },
      });
      applySelectData(data);
    } catch (err) {
      const conflict = resolveActionConflict(err, {
        onSessionMismatch: () => void sharedSession.probe(),
      });
      if (conflict) {
        setInterrupt(conflict);
        resetActivePane();
        void fetchQueueRef.current();
        return;
      }
      setMode('error');
      setPaneError(err instanceof Error ? err.message : 'Load failed');
    }
  }, [ajaxUrl, applySelectData, csrfToken, resetActivePane, sharedSession]);

  const handleResolvePatient = useCallback(async (pid: number) => {
    if (sharedSession.blocked) return;

    setSearchHint(null);

    try {
      const data = await oeFetch<CashierResolveData>('cashier.resolve_patient', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { pid },
      });

      if (data.message) {
        setSearchHint({
          text: data.message,
          variant: data.resolution === 'not_ready' || data.resolution === 'preview_only' ? 'warning' : 'muted',
        });
      }

      if (data.resolution === 'single') {
        const single = data.ready_for_payment[0];
        if (single?.id) void selectVisit(single.id);
        return;
      }

      if (data.resolution === 'pick_visit' && data.ready_for_payment.length > 0) {
        setPickVisits(data.ready_for_payment);
        setPickOpen(true);
      }
    } catch (err) {
      setSearchHint({
        text: err instanceof Error ? err.message : 'Lookup failed',
        variant: 'warning',
      });
    }
  }, [ajaxUrl, csrfToken, selectVisit, sharedSession.blocked]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  useQueueVisibilityRefresh(() => {
    void fetchQueue();
  });

  useInterval(() => {
    if (!document.hidden) void fetchQueue();
  }, pollMs);

  usePageHeadingToolbar({
    dateElementId: 'nc-cashier-date',
    updatedElementId: 'nc-cashier-updated',
    refreshButtonId: 'nc-cashier-refresh',
    visitDate,
    lastUpdated,
    onRefresh: fetchQueue,
  });

  useEffect(() => {
    const storedId = getDeskActiveVisitId(STORAGE_KEY);
    if (storedId > 0 && mode === 'idle') {
      void selectVisit(storedId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executePostCharges = useCallback(async () => {
    if (!selectData || sharedSession.blocked || posting || staged.length === 0) return;

    setPosting(true);
    setPaneError(null);

    const result = await postCashierAction<CashierSelectData>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'cashier.charges.post',
      body: {
        visit_id: selectData.visit.id,
        lines: staged.map((line) => ({
          fee_schedule_id: line.fee_schedule_id,
          units: line.units,
          ...(line.unit_price !== undefined ? { unit_price: line.unit_price } : {}),
        })),
      },
    });

    setPosting(false);
    setDiscountOpen(false);

    if (!result.ok) {
      setPaneError(result.message || 'Failed to post charges');
      return;
    }

    setStaged([]);
    applySelectData(result.data);
    void fetchQueueRef.current();
  }, [ajaxUrl, applySelectData, csrfToken, facilityId, posting, selectData, sharedSession.blocked, staged]);

  const handlePostChargesClick = useCallback(() => {
    if (!selectData) return;
    const allowDiscount = !!(selectData.can_apply_discount ?? canApplyDiscount);
    if (stagedLinesHaveDiscount(staged, selectData.fee_schedule, allowDiscount)) {
      setDiscountOpen(true);
      return;
    }
    void executePostCharges();
  }, [canApplyDiscount, executePostCharges, selectData, staged]);

  const handleTakePaymentClick = useCallback((
    amountReceived: number,
    receiptNote: string,
    paymentMethod: CashierPaymentMethod,
    momoReference: string,
  ) => {
    if (sharedSession.blocked || !selectData) return;
    setPayAmount(amountReceived);
    setPayReceiptNote(receiptNote);
    setPayPaymentMethod(paymentMethod);
    setPayMomoReference(momoReference);
    setPayEsignReason(null);
    setPayCompletionReason(null);
    clientRequestIdRef.current = newClientRequestId();
    if (selectData.completion_blocked && selectData.can_skip_completion) {
      setCompletionOverrideOpen(true);
      return;
    }
    setPayConfirmOpen(true);
  }, [selectData, sharedSession.blocked]);

  const handleEsignOverrideClick = useCallback((
    amountReceived: number,
    receiptNote: string,
    paymentMethod: CashierPaymentMethod,
    momoReference: string,
  ) => {
    if (sharedSession.blocked || !selectData) return;
    setPayAmount(amountReceived);
    setPayReceiptNote(receiptNote);
    setPayPaymentMethod(paymentMethod);
    setPayMomoReference(momoReference);
    setEsignOpen(true);
  }, [selectData, sharedSession.blocked]);

  const handleConfirmPayment = useCallback(async () => {
    if (!selectData || paySubmitting) return;

    setPaySubmitting(true);
    setPaneError(null);

    const result = await postCashierAction<CashierPayResult>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'cashier.pay',
      body: {
        visit_id: selectData.visit.id,
        row_version: selectData.visit.row_version ?? 0,
        amount_received: payAmount,
        receipt_note: payReceiptNote,
        payment_method: payPaymentMethod,
        ...(payPaymentMethod === 'momo' ? { momo_reference: payMomoReference } : {}),
        client_request_id: clientRequestIdRef.current,
        ...(payEsignReason ? { esign_override_reason: payEsignReason } : {}),
        ...(payCompletionReason ? { completion_override_reason: payCompletionReason } : {}),
      },
    });

    setPaySubmitting(false);
    setPayConfirmOpen(false);
    setEsignOpen(false);

    if (!result.ok) {
      const data = result.data as { code?: string; encounter_url?: string } | undefined;
      if (result.status === 409 && data?.code === 'encounter_unsigned' && data.encounter_url) {
        window.open(data.encounter_url, '_blank', 'noopener,noreferrer');
      }
      setPaneError(result.message || 'Payment failed');
      return;
    }

    setReceiptPreview(selectData.preview);
    setReceipt(result.data.receipt);
    setReceiptHistoryUrl(result.data.payment_history_url ?? null);
    resetActivePane();
    void fetchQueueRef.current();
  }, [
    ajaxUrl,
    csrfToken,
    facilityId,
    payAmount,
    payCompletionReason,
    payEsignReason,
    payReceiptNote,
    payPaymentMethod,
    payMomoReference,
    paySubmitting,
    resetActivePane,
    selectData,
  ]);

  const handleCloseZero = useCallback(async (reason: string) => {
    if (!selectData || closeZeroSubmitting) return;

    setCloseZeroSubmitting(true);
    setCloseZeroError(null);

    const result = await postCashierAction<{ visit?: unknown }>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'cashier.close_zero',
      body: {
        visit_id: selectData.visit.id,
        row_version: selectData.visit.row_version ?? 0,
        reason,
      },
    });

    setCloseZeroSubmitting(false);

    if (!result.ok) {
      setCloseZeroError(result.message || 'Close failed');
      return;
    }

    setCloseZeroOpen(false);
    resetActivePane();
    void fetchQueueRef.current();
  }, [ajaxUrl, closeZeroSubmitting, csrfToken, facilityId, resetActivePane, selectData]);

  const handleMarkUnpaid = useCallback(async (reason: string) => {
    if (!selectData || markUnpaidSubmitting) return;

    setMarkUnpaidSubmitting(true);
    setMarkUnpaidError(null);

    const result = await postCashierAction<{ visit?: unknown }>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'cashier.mark_unpaid',
      body: {
        visit_id: selectData.visit.id,
        row_version: selectData.visit.row_version ?? 0,
        reason,
      },
    });

    setMarkUnpaidSubmitting(false);

    if (!result.ok) {
      setMarkUnpaidError(result.message || 'Mark unpaid failed');
      return;
    }

    setMarkUnpaidOpen(false);
    resetActivePane();
    void fetchQueueRef.current();
  }, [ajaxUrl, csrfToken, facilityId, markUnpaidSubmitting, resetActivePane, selectData]);

  const handleConfirmPartial = useCallback(async (
    amountReceived: number,
    reason: string,
    paymentMethod: CashierPaymentMethod,
    momoReference: string,
  ) => {
    if (!selectData || partialSubmitting) return;

    setPartialSubmitting(true);
    setPartialError(null);

    const result = await postCashierAction<CashierPayResult>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'cashier.pay_partial',
      body: {
        visit_id: selectData.visit.id,
        row_version: selectData.visit.row_version ?? 0,
        amount_received: amountReceived,
        reason,
        payment_method: paymentMethod,
        ...(paymentMethod === 'momo' ? { momo_reference: momoReference } : {}),
        client_request_id: newClientRequestId(),
      },
    });

    setPartialSubmitting(false);

    if (!result.ok) {
      setPartialError(result.message || 'Partial payment failed');
      return;
    }

    setPartialOpen(false);
    setReceiptPreview(selectData.preview);
    setReceipt(result.data.receipt);
    setReceiptHistoryUrl(result.data.payment_history_url ?? null);
    resetActivePane();
    void fetchQueueRef.current();
  }, [ajaxUrl, csrfToken, facilityId, partialSubmitting, resetActivePane, selectData]);

  const handleConfirmScheme = useCallback(async (
    schemeId: number,
    membership: string,
    coverageLines: CashierCoverageLine[],
    amountReceived: number,
    paymentMethod: CashierPaymentMethod,
    momoReference: string,
  ) => {
    if (!selectData || schemeSubmitting) return;

    setSchemeSubmitting(true);
    setSchemeError(null);

    const result = await postCashierAction<CashierPayResult>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'cashier.scheme.pay',
      body: {
        visit_id: selectData.visit.id,
        row_version: selectData.visit.row_version ?? 0,
        scheme_id: schemeId,
        membership_number: membership,
        coverage_lines: coverageLines,
        amount_received: amountReceived,
        payment_method: paymentMethod,
        ...(paymentMethod === 'momo' ? { momo_reference: momoReference } : {}),
        client_request_id: newClientRequestId(),
      },
    });

    setSchemeSubmitting(false);

    if (!result.ok) {
      setSchemeError(result.message || 'Scheme payment failed');
      return;
    }

    setSchemeOpen(false);
    setReceiptPreview(selectData.preview);
    setReceipt(result.data.receipt);
    setReceiptHistoryUrl(result.data.payment_history_url ?? null);
    resetActivePane();
    void fetchQueueRef.current();
  }, [ajaxUrl, csrfToken, facilityId, schemeSubmitting, resetActivePane, selectData]);

  const mergedSelectData = selectData
    ? mergeSelectData(selectData, canSkipCompletion, canApplyDiscount)
    : null;

  const discountLines = mergedSelectData
    ? getDiscountLines(staged, mergedSelectData.fee_schedule)
    : [];

  const esignOverrideAllowed = !!(signMeta?.can_esign_override ?? canEsignOverride);
  const inCheckout = mode === 'checkout' || mode === 'loading';

  return (
    <div id="nc-cashier-desk" className="nc-cashier-react-active">
      <DeskInterruptBanner
        interrupt={interrupt}
        onDismiss={() => {
          setInterrupt(null);
          resetActivePane();
          void fetchQueue();
        }}
      />

      {sharedSession.probeData && (
        <DeskSharedDeviceBanner
          prefix="nc-cashier"
          probeData={sharedSession.probeData}
          compareMode="pid_only"
          hint="Return to the queue before posting payment."
          onReturnToQueue={sharedSession.returnToQueue}
        />
      )}

      <QueueTruncationBanner truncated={queueTruncated} cap={200} />

      <DeskQueueStatusBar
        id="nc-cashier-status-bar"
        ariaLabel="Cashier desk status"
        items={[
          {
            label: 'Waiting for payment',
            value: counts?.waiting ?? 0,
            href: (counts?.waiting ?? 0) > 0 ? visitBoardUrl : undefined,
          },
          { label: 'Paid today', value: counts?.paid_today ?? 0 },
        ]}
        loading={queueLoading}
      />

      <div className="nc-cashier-desk">
        <CashierDeskLayout
          activePane={(
            <CashierActivePane
              mode={mode}
              data={mergedSelectData}
              staged={staged}
              signMeta={signMeta}
              visitBoardUrl={visitBoardUrl}
              canMarkUnpaid={canMarkUnpaid}
              canPartialPay={canPartialPay}
              enablePartialPayment={enablePartialPayment}
              enableInsuranceScheme={enableInsuranceScheme}
              esignOverrideAllowed={esignOverrideAllowed}
              blocked={sharedSession.blocked}
              posting={posting}
              paneError={paneError}
              onStagedChange={setStaged}
              onPostCharges={() => void handlePostChargesClick()}
              onTakePayment={handleTakePaymentClick}
              onEsignOverride={handleEsignOverrideClick}
              onMarkUnpaid={() => setMarkUnpaidOpen(true)}
              onCloseZero={() => setCloseZeroOpen(true)}
              onPartialPay={() => setPartialOpen(true)}
              onSchemeSplit={() => setSchemeOpen(true)}
            />
          )}
          queue={(
            <CashierQueue
              ajaxUrl={ajaxUrl}
              csrfToken={csrfToken}
              cards={cards}
              paidToday={paidToday ?? []}
              loading={queueLoading}
              error={queueError}
              blocked={sharedSession.blocked}
              searchHint={searchHint}
              onSelectVisit={(card) => void selectVisit(card.id)}
              onSelectPatient={(pid) => void handleResolvePatient(pid)}
            />
          )}
        />
      </div>

      {narrowDesk && (
        <>
          <CashierMobileQueueBar
            waitingCount={counts?.waiting ?? cards.length}
            inCheckout={inCheckout}
            onOpen={() => setMobileQueueOpen(true)}
          />
          <CashierMobileQueueSheet
            open={mobileQueueOpen}
            onClose={() => setMobileQueueOpen(false)}
            waitingCount={counts?.waiting ?? cards.length}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            cards={cards}
            paidToday={paidToday ?? []}
            loading={queueLoading}
            error={queueError}
            blocked={sharedSession.blocked}
            searchHint={searchHint}
            onSelectVisit={(card) => void selectVisit(card.id)}
            onSelectPatient={(pid) => void handleResolvePatient(pid)}
          />
        </>
      )}

      <PayConfirmModal
        open={payConfirmOpen}
        preview={mergedSelectData?.preview ?? null}
        visit={mergedSelectData?.visit ?? null}
        total={mergedSelectData?.charges_total ?? 0}
        amountReceived={payAmount}
        paymentMethod={payPaymentMethod}
        momoReference={payMomoReference}
        completionBlocked={!!mergedSelectData?.completion_blocked}
        canSkipCompletion={!!mergedSelectData?.can_skip_completion}
        completionOverride={!!payCompletionReason}
        esignOverride={!!payEsignReason}
        submitting={paySubmitting}
        onClose={() => setPayConfirmOpen(false)}
        onConfirm={() => void handleConfirmPayment()}
      />

      <EsignOverrideModal
        open={esignOpen}
        preview={mergedSelectData?.preview ?? null}
        visit={mergedSelectData?.visit ?? null}
        confirmLabel="Pay with override"
        reasonFieldId="nc-cashier-esign-reason"
        onClose={() => setEsignOpen(false)}
        onConfirm={(reason) => {
          setPayEsignReason(reason);
          setEsignOpen(false);
          if (mergedSelectData?.completion_blocked && mergedSelectData?.can_skip_completion) {
            setCompletionOverrideOpen(true);
            return;
          }
          clientRequestIdRef.current = newClientRequestId();
          setPayConfirmOpen(true);
        }}
      />

      <EsignOverrideModal
        open={completionOverrideOpen}
        preview={mergedSelectData?.preview ?? null}
        visit={mergedSelectData?.visit ?? null}
        title="Override completion"
        confirmLabel="Continue to payment"
        reasonFieldId="nc-cashier-completion-override-reason"
        onClose={() => setCompletionOverrideOpen(false)}
        onConfirm={(reason) => {
          setPayCompletionReason(reason);
          setCompletionOverrideOpen(false);
          clientRequestIdRef.current = newClientRequestId();
          setPayConfirmOpen(true);
        }}
      />

      <DiscountConfirmModal
        open={discountOpen}
        preview={mergedSelectData?.preview ?? null}
        visit={mergedSelectData?.visit ?? null}
        lines={discountLines}
        submitting={posting}
        onClose={() => setDiscountOpen(false)}
        onConfirm={() => void executePostCharges()}
      />

      <PickVisitModal
        open={pickOpen}
        visits={pickVisits}
        onClose={() => setPickOpen(false)}
        onPick={(visitId) => {
          setPickOpen(false);
          void selectVisit(visitId);
        }}
      />

      <ReceiptModal
        open={receipt !== null}
        preview={receiptPreview}
        receipt={receipt}
        historyUrl={receiptHistoryUrl}
        onClose={() => {
          setReceipt(null);
          setReceiptPreview(null);
          setReceiptHistoryUrl(null);
        }}
      />

      <CloseZeroModal
        open={closeZeroOpen}
        submitting={closeZeroSubmitting}
        error={closeZeroError}
        onClose={() => {
          setCloseZeroOpen(false);
          setCloseZeroError(null);
        }}
        onConfirm={(reason) => void handleCloseZero(reason)}
      />

      <MarkUnpaidModal
        open={markUnpaidOpen}
        preview={mergedSelectData?.preview ?? null}
        visit={mergedSelectData?.visit ?? null}
        submitting={markUnpaidSubmitting}
        error={markUnpaidError}
        onClose={() => {
          setMarkUnpaidOpen(false);
          setMarkUnpaidError(null);
        }}
        onConfirm={(reason) => void handleMarkUnpaid(reason)}
      />

      <PartialPayModal
        open={partialOpen}
        preview={mergedSelectData?.preview ?? null}
        visit={mergedSelectData?.visit ?? null}
        total={mergedSelectData?.charges_total ?? 0}
        momoEnabled={!!mergedSelectData?.enable_momo_payment}
        submitting={partialSubmitting}
        error={partialError}
        onClose={() => {
          setPartialOpen(false);
          setPartialError(null);
        }}
        onConfirm={(amount, reason, method, momoRef) => void handleConfirmPartial(amount, reason, method, momoRef)}
      />

      <SchemeSplitModal
        open={schemeOpen}
        preview={mergedSelectData?.preview ?? null}
        visit={mergedSelectData?.visit ?? null}
        charges={mergedSelectData?.charges ?? []}
        drugCharges={mergedSelectData?.drug_charges ?? []}
        momoEnabled={!!mergedSelectData?.enable_momo_payment}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        submitting={schemeSubmitting}
        error={schemeError}
        onClose={() => {
          setSchemeOpen(false);
          setSchemeError(null);
        }}
        onConfirm={(schemeId, membership, coverageLines, amount, method, momoRef) =>
          void handleConfirmScheme(schemeId, membership, coverageLines, amount, method, momoRef)}
      />
    </div>
  );
}
