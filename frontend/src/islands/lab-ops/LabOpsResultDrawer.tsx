import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { identityFromLabels } from '@components/patientBannerUtils';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { createLabResultValidator, type ValidationCheck } from './labResultValidation';
import { CriticalNotificationModal, type CriticalNotification } from './CriticalNotificationModal';
import { AmendResultModal } from './AmendResultModal';
import type { ResultEntryForm, ResultLine, ResultLineValue, ValidationRules } from './labOpsTypes';

const EMPTY_CRITICAL_NOTIFICATION: CriticalNotification = {
  notified_name: '',
  notified_role: '',
  method: '',
  read_back_confirmed: false,
  note: '',
};

type DrawerView = 'form' | 'saved' | 'released';

interface LineDraft {
  procedure_order_seq: number;
  procedure_report_id: number | null;
  procedure_result_id: number | null;
  result: string;
  units: string;
  range: string;
  abnormal: string;
  comments: string;
}

interface LabOpsResultDrawerProps {
  open: boolean;
  orderId: number | null;
  ajaxUrl: string;
  csrfToken: string;
  canEnter: boolean;
  canRelease: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function LabOpsPatientBanner({ order }: { order: ResultEntryForm['order'] }) {
  const patientIdentity = identityFromLabels(order?.patient_name, { pubpid: order?.pubpid });
  if (!patientIdentity) {
    return null;
  }

  return (
    <PatientContextBanner
      layout="compact"
      identity={patientIdentity}
      aside={order?.queue_number != null && order.queue_number !== '' ? (
        <Badge variant="outline">Q#{order.queue_number}</Badge>
      ) : undefined}
    />
  );
}

/**
 * D-LAB-CRIT — live critical/panic-value detection from the draft values + QC rules, mirroring
 * the server (LabResultValidationService). Critical never blocks entry; it warns loudly so the
 * clinician is notified. The release audit records the same criticals server-side.
 */
function computeCriticalMessages(drafts: LineDraft[], rules: ValidationRules | undefined): string[] {
  const bySeq = rules?.rules_by_seq ?? {};
  const out: string[] = [];
  for (const d of drafts) {
    const rule = bySeq[String(d.procedure_order_seq)];
    if (!rule) continue;
    const label = rule.procedure_name || rule.label || 'Result';
    const value = (d.result ?? '').trim();
    if (value === '') continue;
    if ((rule.type ?? 'text') === 'numeric') {
      const num = parseFloat(value);
      if (Number.isNaN(num)) continue;
      const units = rule.units ? ` ${rule.units}` : '';
      if (rule.crit_min !== undefined && num < rule.crit_min) {
        out.push(`${label} critically LOW (${num}${units})`);
      } else if (rule.crit_max !== undefined && num > rule.crit_max) {
        out.push(`${label} critically HIGH (${num}${units})`);
      }
    } else {
      const crit = (rule.critical_values ?? []).map((v) => v.toLowerCase());
      if (crit.includes(value.toLowerCase())) {
        out.push(`${label} is ${value} (critical)`);
      }
    }
  }
  return out;
}

function linesToDrafts(lines: ResultLine[]): LineDraft[] {
  return lines.map((line) => {
    const result = (line.results ?? [])[0] ?? {};
    return {
      procedure_order_seq: line.procedure_order_seq,
      procedure_report_id: line.procedure_report_id ?? null,
      procedure_result_id: result.procedure_result_id ?? null,
      result: result.result ?? '',
      units: result.units ?? line.qc?.units ?? '',
      range: result.range ?? line.qc?.reference_range ?? '',
      abnormal: result.abnormal ?? '',
      comments: result.comments ?? '',
    };
  });
}

function summarizeDrafts(lines: ResultLine[], drafts: LineDraft[]): string[] {
  return drafts.map((draft) => {
    const match = lines.find((row) => row.procedure_order_seq === draft.procedure_order_seq);
    const label = match?.procedure_name ?? match?.procedure_code ?? 'Test';
    const value = draft.result ? draft.result : '—';
    const abnormal = draft.abnormal ? ` (${draft.abnormal})` : '';
    return `${label}: ${value}${abnormal}`;
  });
}

export function LabOpsResultDrawer({
  open,
  orderId,
  ajaxUrl,
  csrfToken,
  canEnter,
  canRelease,
  onClose,
  onSaved,
}: LabOpsResultDrawerProps) {
  const [entryForm, setEntryForm] = useState<ResultEntryForm | null>(null);
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([]);
  const [viewMode, setViewMode] = useState<DrawerView>('form');
  const [savedDraft, setSavedDraft] = useState(false);
  const [orderReleased, setOrderReleased] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [savedSummary, setSavedSummary] = useState<string[]>([]);
  const [savedWarnings, setSavedWarnings] = useState<string[]>([]);
  const [savedCriticals, setSavedCriticals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [criticalModalOpen, setCriticalModalOpen] = useState(false);
  const [criticalNotification, setCriticalNotification] = useState<CriticalNotification>(
    EMPTY_CRITICAL_NOTIFICATION
  );
  const [amendModalOpen, setAmendModalOpen] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const [amending, setAmending] = useState(false);
  // Whether the loaded order was already released — re-editing it is a reason-gated correction.
  const [alreadyReleased, setAlreadyReleased] = useState(false);
  // Whether we are mid-correction (reason recorded) or the last release was a correction.
  const [correcting, setCorrecting] = useState(false);
  const [wasCorrected, setWasCorrected] = useState(false);

  // After a failed final save, empty fields show "required"; live typing stays lenient.
  const [strict, setStrict] = useState(false);
  // Focus targets for the first invalid line, keyed by seq — no DOM querying.
  const resultRefs = useRef<Record<number, HTMLInputElement | HTMLSelectElement | null>>({});

  // Live critical/panic values as staff type — shown as a loud callout, never blocks entry.
  const liveCriticals = useMemo(
    () => computeCriticalMessages(lineDrafts, entryForm?.validation),
    [lineDrafts, entryForm]
  );

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const validator = useMemo(
    () => createLabResultValidator(entryForm?.validation),
    [entryForm?.validation]
  );

  // Per-line feedback derived from React state (D-LAB-VALIDATE) — replaces the old DOM writes.
  const lineChecks = useMemo(() => {
    const checks: Record<number, ValidationCheck> = {};
    for (const draft of lineDrafts) {
      checks[draft.procedure_order_seq] = validator.evaluate(
        draft.procedure_order_seq,
        draft.result,
        !strict
      );
    }
    return checks;
  }, [lineDrafts, validator, strict]);

  const loadForm = useCallback(async (id: number) => {
    setLoadError(null);
    try {
      const data = await oeFetch<ResultEntryForm>('lab_ops.result_get', {
        ...fetchOptions,
        json: { procedure_order_id: id },
      });
      setEntryForm(data);
      setAlreadyReleased(!!data.already_released);
      setStrict(false);
      const drafts = linesToDrafts(data.lines ?? []);
      setLineDrafts(drafts);
      if ((data.lines ?? []).length > 0 && data.has_saved_results) {
        setViewMode('saved');
        setSavedAt(new Date());
        setSavedSummary(summarizeDrafts(data.lines ?? [], drafts));
      } else {
        setViewMode('form');
        setSavedSummary([]);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load result form');
    }
  }, [fetchOptions]);

  useEffect(() => {
    if (!open || !orderId) {
      setEntryForm(null);
      setLineDrafts([]);
      setViewMode('form');
      setSavedDraft(false);
      setOrderReleased(false);
      setSavedAt(null);
      setSavedSummary([]);
      setSavedWarnings([]);
      setSavedCriticals([]);
      setSaving(false);
      setLoadError(null);
      setCriticalModalOpen(false);
      setCriticalNotification(EMPTY_CRITICAL_NOTIFICATION);
      setAmendModalOpen(false);
      setAmendReason('');
      setAmending(false);
      setAlreadyReleased(false);
      setCorrecting(false);
      setWasCorrected(false);
      return;
    }
    void loadForm(orderId);
  }, [loadForm, open, orderId]);

  const updateLine = useCallback((index: number, patch: Partial<LineDraft>) => {
    setLineDrafts((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }, []);

  // On blur, normalise the value and suggest an abnormal flag — all through React state.
  const handleResultBlur = useCallback((index: number) => {
    const draft = lineDrafts[index];
    if (!draft) return;
    const check = validator.evaluate(draft.procedure_order_seq, draft.result, true);
    const patch: Partial<LineDraft> = {};
    if (check.normalizedValue && check.level !== 'error' && draft.result !== check.normalizedValue) {
      patch.result = check.normalizedValue;
    }
    if (check.suggestedAbnormal && draft.abnormal.trim() === '') {
      patch.abnormal = check.suggestedAbnormal;
    }
    if (Object.keys(patch).length > 0) {
      updateLine(index, patch);
    }
  }, [lineDrafts, updateLine, validator]);

  const collectPayload = useCallback((): ResultLine[] => {
    return lineDrafts.map((draft) => ({
      procedure_order_seq: draft.procedure_order_seq,
      procedure_report_id: draft.procedure_report_id,
      results: [{
        procedure_result_id: draft.procedure_result_id,
        result: draft.result,
        units: draft.units,
        range: draft.range,
        abnormal: draft.abnormal,
        comments: draft.comments,
      } satisfies ResultLineValue],
    }));
  }, [lineDrafts]);

  const saveEntry = useCallback(async (draft: boolean) => {
    if (!orderId || saving) return;

    const check = validator.validateAll(
      lineDrafts.map((line) => ({ seq: line.procedure_order_seq, value: line.result })),
      draft
    );
    if (!check.valid) {
      setStrict(true);
      if (check.firstInvalidSeq !== null) {
        resultRefs.current[check.firstInvalidSeq]?.focus();
      }
      return;
    }

    setSaving(true);
    try {
      const linePayloads = collectPayload();
      const saved = await oeFetch<{
        qc_warnings?: string[];
        field_warnings?: Record<string, string>;
        field_errors?: Record<string, string>;
      }>('lab_ops.result_save', {
        ...fetchOptions,
        json: {
          procedure_order_id: orderId,
          draft,
          lines: linePayloads,
        },
      });

      setViewMode('saved');
      setSavedDraft(draft);
      setSavedAt(new Date());
      setSavedSummary(summarizeDrafts(entryForm?.lines ?? [], lineDrafts));
      setSavedWarnings(saved.qc_warnings ?? Object.values(saved.field_warnings ?? {}));
      await loadForm(orderId);
      onSaved();
    } catch (err) {
      showDeskToast(err instanceof Error ? err.message : 'Save failed', 'danger');
      setViewMode('form');
    } finally {
      setSaving(false);
    }
  }, [collectPayload, entryForm, fetchOptions, lineDrafts, loadForm, onSaved, orderId, saving, validator]);

  const performRelease = useCallback(async (notification: CriticalNotification | null) => {
    if (!orderId || saving) return;
    setSaving(true);
    try {
      const released = await oeFetch<{
        qc_warnings?: string[];
        qc_criticals?: string[];
        encounter_results_ready?: boolean;
        results_ready?: boolean;
        corrected?: boolean;
      }>('lab_ops.result_release', {
        ...fetchOptions,
        json: {
          procedure_order_id: orderId,
          ...(notification ? { critical_notification: notification } : {}),
        },
      });
      setSavedDraft(false);
      setSavedAt(new Date());
      setSavedWarnings(released.qc_warnings ?? []);
      setSavedCriticals(released.qc_criticals ?? []);
      setOrderReleased(true);
      setAlreadyReleased(true);
      setWasCorrected(!!released.corrected);
      setCorrecting(false);
      setCriticalModalOpen(false);
      setViewMode(released.encounter_results_ready || released.results_ready ? 'released' : 'saved');
      onSaved();
    } catch (err) {
      showDeskToast(err instanceof Error ? err.message : 'Release failed', 'danger');
    } finally {
      setSaving(false);
    }
  }, [fetchOptions, onSaved, orderId, saving]);

  // Releasing a critical result must capture who was notified (SLIPTA); open the read-back
  // modal first. A release with no critical values proceeds straight through.
  const releaseOrder = useCallback(() => {
    if (!orderId || saving) return;
    if (liveCriticals.length > 0) {
      setCriticalNotification(EMPTY_CRITICAL_NOTIFICATION);
      setCriticalModalOpen(true);
      return;
    }
    void performRelease(null);
  }, [liveCriticals, orderId, performRelease, saving]);

  // Amend a released result (ISO 15189): record a reason, then reopen the form for the correction.
  const performAmend = useCallback(async () => {
    if (!orderId || amending) return;
    setAmending(true);
    try {
      await oeFetch('lab_ops.result_amend', {
        ...fetchOptions,
        json: { procedure_order_id: orderId, reason: amendReason },
      });
      setAmendModalOpen(false);
      setAmendReason('');
      await loadForm(orderId);
      setViewMode('form');
      setCorrecting(true);
      showDeskToast('Amendment started — edit and release the corrected result', 'info');
    } catch (err) {
      showDeskToast(err instanceof Error ? err.message : 'Could not start amendment', 'danger');
    } finally {
      setAmending(false);
    }
  }, [amendReason, amending, fetchOptions, loadForm, orderId]);

  // The saved-view edit action: a released result routes through the amendment reason gate,
  // unless a correction is already in progress (then it just reopens the form).
  const startEdit = useCallback(() => {
    if (!orderId) return;
    if (alreadyReleased && !correcting) {
      setAmendReason('');
      setAmendModalOpen(true);
      return;
    }
    void loadForm(orderId).then(() => setViewMode('form'));
  }, [alreadyReleased, correcting, loadForm, orderId]);

  if (!open) return null;

  const order = entryForm?.order;
  const lines = entryForm?.lines ?? [];
  const timeLabel = savedAt ? savedAt.toLocaleTimeString() : new Date().toLocaleTimeString();

  const renderQcWarnings = (warnings: string[]) => {
    if (!warnings.length) return null;
    return (
      <div className={deskCalloutClass('warn', 'py-2 px-3 mt-3 mb-0')}>
        <strong className="block mb-1">Review before release</strong>
        {warnings.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
    );
  };

  const renderQcCriticals = (criticals: string[]) => {
    if (!criticals.length) return null;
    return (
      <div className={deskCalloutClass('error', 'py-2 px-3 mt-3 mb-0')} role="alert">
        <strong className="block mb-1">Critical result — notify the clinician now</strong>
        {criticals.map((c) => (
          <div key={c}>{c}</div>
        ))}
      </div>
    );
  };

  const renderSavedPanel = (released: boolean) => {
    const title = wasCorrected
      ? 'Corrected result released'
      : released
        ? 'Released to doctor'
        : orderReleased
          ? 'Order released'
          : savedDraft
            ? 'Draft saved'
            : 'Results saved';
    const hint = released
      ? 'The doctor can see these results on the consult card.'
      : orderReleased
        ? 'This panel is released. Other lab orders for the visit may still be pending.'
        : savedDraft
          ? 'Draft is saved. Release to doctor when results are final.'
          : 'Results are saved. A lab lead can release them to the doctor.';

    return (
      <>
        <LabOpsPatientBanner order={order} />
        <div className="nc-labops-saved" role="status" aria-live="polite">
          <div className="flex items-start">
            <Badge variant="success" className="mr-2 mt-1 shrink-0">
              {released || orderReleased ? 'Released' : 'Saved'}
            </Badge>
            <div className="flex-grow min-w-0">
              <strong>{title} at {timeLabel}</strong>
              <div className="nc-labops-saved-summary mt-2">
                {savedSummary.length ? (
                  <ul className="mb-0 pl-3">
                    {savedSummary.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-0 text-[var(--oe-nc-text-muted)]">Result values recorded for this order.</p>
                )}
              </div>
              {renderQcCriticals(savedCriticals)}
              {renderQcWarnings(savedWarnings)}
              <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0 mt-2">{hint}</p>
            </div>
          </div>
        </div>
      </>
    );
  };

  const drawerTitle = viewMode === 'released'
    ? 'Results released'
    : viewMode === 'saved'
      ? 'Lab results saved'
      : `Enter results — ${lines[0]?.procedure_name ?? 'Lab order'}`;

  // A released result (not already mid-correction) must be re-opened through the amendment
  // reason gate, which needs release privilege. Re-release is only offered inside a correction.
  const canAmend = alreadyReleased && !correcting;
  const showEditButton = viewMode !== 'released' && (!canAmend || canRelease);
  const showSavedRelease = canRelease && viewMode !== 'released' && !savedDraft
    && !!orderId && (!alreadyReleased || correcting);

  return (
    <>
    <SlideOver
      open={open}
      onClose={onClose}
      dismissOnOutsideClick={false}
      title={drawerTitle}
      id="nc-labops-drawer"
      titleId="nc-labops-drawer-title"
      width="md"
      footer={(
        <>
          {viewMode === 'saved' || viewMode === 'released' ? (
            <>
              <Button type="button" size="sm" onClick={onClose}>
                Done
              </Button>
              {showEditButton ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startEdit}
                >
                  {canAmend ? 'Amend result' : 'Edit results'}
                </Button>
              ) : null}
              {showSavedRelease ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={saving}
                  onClick={() => void releaseOrder()}
                >
                  Release to doctor
                </Button>
              ) : null}
            </>
          ) : canEnter && lines.length ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => void saveEntry(true)}
              >
                {saving ? 'Saving…' : 'Save draft'}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() => void saveEntry(false)}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {canRelease && !savedDraft && orderId ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={saving}
                  onClick={() => void releaseOrder()}
                >
                  Release to doctor
                </Button>
              ) : null}
            </>
          ) : null}
        </>
      )}
    >
      <div id="nc-labops-drawer-body">
          {loadError ? (
            <div className={deskCalloutClass('error')}>{loadError}</div>
          ) : viewMode === 'saved' || viewMode === 'released' ? (
            renderSavedPanel(viewMode === 'released')
          ) : (
            <>
              <LabOpsPatientBanner order={order} />
              {correcting ? (
                <div className={deskCalloutClass('warn', 'py-2 px-3 mt-3 mb-0')} role="status">
                  <strong className="block mb-1">Correcting a released result</strong>
                  The original values and your reason are saved. Edit below, then release the
                  corrected result.
                </div>
              ) : null}
              {renderQcCriticals(liveCriticals)}
              {lineDrafts.map((draft, idx) => {
                const line = lines[idx];
                const qc = line?.qc ?? {};
                const resultOptions = qc.allowed ?? [];
                const check = lineChecks[draft.procedure_order_seq];
                const hasError = check?.level === 'error';
                return (
                  <div
                    key={draft.procedure_order_seq}
                    className="nc-labops-line"
                    data-line-index={idx}
                  >
                    <div className="font-bold mb-1">
                      {line?.procedure_name ?? line?.procedure_code}
                    </div>
                    {qc.hint ? <div className="text-sm text-[var(--oe-nc-text-muted)] mb-1">{qc.hint}</div> : null}
                    <div className="nc-form-group">
                      <label>
                        Result value <span className="text-[var(--oe-nc-danger,#dc2626)]">*</span>
                      </label>
                      {resultOptions.length ? (
                        // Qualitative test (e.g. Malaria RDT, pregnancy): pick from the
                        // defined values instead of free-typing "postive"/"+"/"pos".
                        <NativeSelect
                          className={`h-8${hasError ? ' is-invalid' : ''}`}
                          data-field="result"
                          aria-invalid={hasError}
                          ref={(el) => { resultRefs.current[draft.procedure_order_seq] = el; }}
                          // Match case-insensitively so a value saved before this
                          // dropdown (e.g. "Positive") still shows its option.
                          value={resultOptions.find((o) => o.toLowerCase() === draft.result.toLowerCase()) ?? ''}
                          onChange={(e) => updateLine(idx, { result: e.target.value })}
                          onBlur={() => handleResultBlur(idx)}
                        >
                          <option value="">— select result —</option>
                          {resultOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt.charAt(0).toUpperCase() + opt.slice(1)}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Input
                          className={`h-8${hasError ? ' is-invalid' : ''}`}
                          data-field="result"
                          aria-invalid={hasError}
                          ref={(el) => { resultRefs.current[draft.procedure_order_seq] = el; }}
                          value={draft.result}
                          onChange={(e) => updateLine(idx, { result: e.target.value })}
                          onBlur={() => handleResultBlur(idx)}
                        />
                      )}
                      {check && check.level !== 'ok' && check.message ? (
                        <div
                          className={`nc-labops-feedback block text-sm${
                            hasError
                              ? ' text-[var(--oe-nc-danger,#dc2626)]'
                              : ' nc-labops-feedback--warning'
                          }`}
                          role={hasError ? 'alert' : undefined}
                        >
                          {check.message}
                        </div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col">
                        <label>Units</label>
                        <Input
                          className="h-8"
                          data-field="units"
                          value={draft.units}
                          onChange={(e) => updateLine(idx, { units: e.target.value })}
                        />
                      </div>
                      <div className="col">
                        <label>Range</label>
                        <Input
                          className="h-8"
                          data-field="range"
                          value={draft.range}
                          onChange={(e) => updateLine(idx, { range: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="nc-form-group mt-2">
                      <label>Abnormal</label>
                      <NativeSelect
                        className="h-8"
                        data-field="abnormal"
                        value={draft.abnormal}
                        onChange={(e) => updateLine(idx, { abnormal: e.target.value })}
                      >
                        <option value="">—</option>
                        <option value="yes">yes</option>
                        <option value="high">high</option>
                        <option value="low">low</option>
                      </NativeSelect>
                    </div>
                    <div className="nc-form-group">
                      <label>Note</label>
                      <Input
                        className="h-8"
                        data-field="comments"
                        value={draft.comments}
                        onChange={(e) => updateLine(idx, { comments: e.target.value })}
                      />
                    </div>
                  </div>
                );
              })}
              {!lines.length ? (
                <>
                  <div className={deskCalloutClass('warn', 'mb-0')}>
                    This order has no tests yet. Add at least one test line before entering results.
                  </div>
                  {entryForm?.edit_order_url ? (
                    <Button variant="default" size="sm" className="mt-3" asChild>
                      <a href={entryForm.edit_order_url} target="_top">
                        Add tests to order
                      </a>
                    </Button>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
    </SlideOver>
    <CriticalNotificationModal
      open={criticalModalOpen}
      criticals={liveCriticals}
      value={criticalNotification}
      submitting={saving}
      onChange={(patch) => setCriticalNotification((prev) => ({ ...prev, ...patch }))}
      onConfirm={() => void performRelease(criticalNotification)}
      onClose={() => setCriticalModalOpen(false)}
    />
    <AmendResultModal
      open={amendModalOpen}
      reason={amendReason}
      submitting={amending}
      onReasonChange={setAmendReason}
      onConfirm={() => void performAmend()}
      onClose={() => setAmendModalOpen(false)}
    />
    </>
  );
}
