import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { createLabResultValidator } from './labResultValidation';
import type { ResultEntryForm, ResultLine, ResultLineValue } from './labOpsTypes';

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

function patientLine(order: ResultEntryForm['order']): string {
  const parts = [order?.patient_name ?? ''];
  if (order?.pubpid) parts.push(`MRN ${order.pubpid}`);
  if (order?.queue_number) parts.push(`Q#${order.queue_number}`);
  return parts.filter(Boolean).join(' · ');
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
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const validator = useMemo(
    () => createLabResultValidator(entryForm?.validation),
    [entryForm?.validation]
  );

  const loadForm = useCallback(async (id: number) => {
    setLoadError(null);
    try {
      const data = await oeFetch<ResultEntryForm>('lab_ops.result_get', {
        ...fetchOptions,
        json: { procedure_order_id: id },
      });
      setEntryForm(data);
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
      setSaving(false);
      setLoadError(null);
      return;
    }
    void loadForm(orderId);
  }, [loadForm, open, orderId]);

  useEffect(() => {
    if (viewMode !== 'form' || !bodyRef.current) return;
    bodyRef.current.querySelectorAll<HTMLElement>('.oe-nc-labops-line').forEach((lineEl) => {
      const seqInput = lineEl.querySelector<HTMLInputElement>('[data-field="procedure_order_seq"]');
      if (!seqInput) return;
      const seq = parseInt(seqInput.value, 10);
      validator.applyDefaults(lineEl, seq);
    });
  }, [lineDrafts, validator, viewMode]);

  const updateLine = useCallback((index: number, patch: Partial<LineDraft>) => {
    setLineDrafts((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }, []);

  const handleResultBlur = useCallback((index: number, lineEl: HTMLElement | null) => {
    if (!lineEl) return;
    const check = validator.validateLine(lineEl, true);
    validator.applyFieldFeedback(lineEl, check);
    const seqInput = lineEl.querySelector<HTMLInputElement>('[data-field="procedure_order_seq"]');
    const resultInput = lineEl.querySelector<HTMLInputElement>('[data-field="result"]');
    if (seqInput && resultInput) {
      validator.suggestAbnormal(lineEl, parseInt(seqInput.value, 10), resultInput.value);
      if (check.normalizedValue && check.level !== 'error' && resultInput.value !== check.normalizedValue) {
        updateLine(index, { result: check.normalizedValue });
      }
    }
  }, [updateLine, validator]);

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

    if (bodyRef.current) {
      const check = validator.validateAll(bodyRef.current, draft);
      if (!check.valid) {
        validator.focusFirstInvalid(bodyRef.current);
        return;
      }
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
      const message = err instanceof Error ? err.message : 'Save failed';
      window.alert(message);
      setViewMode('form');
    } finally {
      setSaving(false);
    }
  }, [collectPayload, entryForm, fetchOptions, lineDrafts, loadForm, onSaved, orderId, saving, validator]);

  const releaseOrder = useCallback(async () => {
    if (!orderId || saving) return;
    setSaving(true);
    try {
      const released = await oeFetch<{
        qc_warnings?: string[];
        encounter_results_ready?: boolean;
        results_ready?: boolean;
      }>('lab_ops.result_release', {
        ...fetchOptions,
        json: { procedure_order_id: orderId },
      });
      setSavedDraft(false);
      setSavedAt(new Date());
      setSavedWarnings(released.qc_warnings ?? []);
      setOrderReleased(true);
      setViewMode(released.encounter_results_ready || released.results_ready ? 'released' : 'saved');
      onSaved();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Release failed');
    } finally {
      setSaving(false);
    }
  }, [fetchOptions, onSaved, orderId, saving]);

  if (!open) return null;

  const order = entryForm?.order;
  const lines = entryForm?.lines ?? [];
  const timeLabel = savedAt ? savedAt.toLocaleTimeString() : new Date().toLocaleTimeString();

  const renderQcWarnings = (warnings: string[]) => {
    if (!warnings.length) return null;
    return (
      <div className="alert alert-warning py-2 px-3 mt-3 mb-0 border border-warning">
        <strong className="d-block mb-1">Review before release</strong>
        {warnings.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
    );
  };

  const renderSavedPanel = (released: boolean) => {
    const title = released
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
        <p className="small text-muted mb-3">{patientLine(order)}</p>
        <div className="oe-nc-labops-saved" role="status" aria-live="polite">
          <div className="d-flex align-items-start">
            <span className="badge badge-success mr-2 mt-1">
              {released || orderReleased ? 'Released' : 'Saved'}
            </span>
            <div className="flex-grow-1">
              <strong>{title} at {timeLabel}</strong>
              <div className="oe-nc-labops-saved__summary mt-2">
                {savedSummary.length ? (
                  <ul className="mb-0 pl-3">
                    {savedSummary.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-0 text-muted">Result values recorded for this order.</p>
                )}
              </div>
              {renderQcWarnings(savedWarnings)}
              <p className="text-muted small mb-0 mt-2">{hint}</p>
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

  return (
    <>
      <div
        className="oe-nc-labops-drawer-backdrop"
        id="nc-labops-drawer-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className="oe-nc-labops-drawer"
        id="nc-labops-drawer"
        aria-labelledby="nc-labops-drawer-title"
        role="dialog"
        aria-modal="true"
      >
        <header className="oe-nc-labops-drawer__header">
          <h2 className="h6 mb-0" id="nc-labops-drawer-title">{drawerTitle}</h2>
          <button type="button" className="close" id="nc-labops-drawer-close" aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <div className="oe-nc-labops-drawer__body" id="nc-labops-drawer-body" ref={bodyRef}>
          {loadError ? (
            <div className="alert alert-danger">{loadError}</div>
          ) : viewMode === 'saved' || viewMode === 'released' ? (
            renderSavedPanel(viewMode === 'released')
          ) : (
            <>
              <p className="small text-muted mb-3">{patientLine(order)}</p>
              {lineDrafts.map((draft, idx) => {
                const line = lines[idx];
                const qc = line?.qc ?? {};
                const listId = qc.allowed?.length ? `nc-labops-allowed-${idx}` : undefined;
                return (
                  <div
                    key={draft.procedure_order_seq}
                    className="oe-nc-labops-line"
                    data-line-index={idx}
                  >
                    <input type="hidden" data-field="procedure_order_seq" value={draft.procedure_order_seq} readOnly />
                    <input type="hidden" data-field="procedure_report_id" value={draft.procedure_report_id ?? ''} readOnly />
                    <input type="hidden" data-field="procedure_result_id" value={draft.procedure_result_id ?? ''} readOnly />
                    <div className="font-weight-bold mb-1">
                      {line?.procedure_name ?? line?.procedure_code}
                    </div>
                    {qc.hint ? <div className="small text-muted mb-1">{qc.hint}</div> : null}
                    <div className="form-group">
                      <label>
                        Result value <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control form-control-sm"
                        data-field="result"
                        list={listId}
                        value={draft.result}
                        onChange={(e) => updateLine(idx, { result: e.target.value })}
                        onBlur={(e) => handleResultBlur(idx, e.currentTarget.closest('.oe-nc-labops-line'))}
                      />
                      <div className="nc-labops-feedback" />
                    </div>
                    {listId ? (
                      <datalist id={listId}>
                        {(qc.allowed ?? []).map((opt) => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    ) : null}
                    <div className="form-row">
                      <div className="col">
                        <label>Units</label>
                        <input
                          className="form-control form-control-sm"
                          data-field="units"
                          value={draft.units}
                          onChange={(e) => updateLine(idx, { units: e.target.value })}
                        />
                      </div>
                      <div className="col">
                        <label>Range</label>
                        <input
                          className="form-control form-control-sm"
                          data-field="range"
                          value={draft.range}
                          onChange={(e) => updateLine(idx, { range: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-group mt-2">
                      <label>Abnormal</label>
                      <select
                        className="form-control form-control-sm"
                        data-field="abnormal"
                        value={draft.abnormal}
                        onChange={(e) => updateLine(idx, { abnormal: e.target.value })}
                      >
                        <option value="">—</option>
                        <option value="yes">yes</option>
                        <option value="high">high</option>
                        <option value="low">low</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Note</label>
                      <input
                        className="form-control form-control-sm"
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
                  <div className="alert alert-warning mb-0">
                    This order has no tests yet. Add at least one test line before entering results.
                  </div>
                  {entryForm?.edit_order_url ? (
                    <a className="btn btn-primary btn-sm mt-3" href={entryForm.edit_order_url} target="_top">
                      Add tests to order
                    </a>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>

        <footer className="oe-nc-labops-drawer__footer" id="nc-labops-drawer-footer">
          {viewMode === 'saved' || viewMode === 'released' ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
                Done
              </button>
              {viewMode !== 'released' ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    if (orderId) void loadForm(orderId).then(() => setViewMode('form'));
                  }}
                >
                  Edit results
                </button>
              ) : null}
              {canRelease && viewMode !== 'released' && !savedDraft && orderId ? (
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  disabled={saving}
                  onClick={() => void releaseOrder()}
                >
                  Release to doctor
                </button>
              ) : null}
            </>
          ) : canEnter && lines.length ? (
            <>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={saving}
                onClick={() => void saveEntry(true)}
              >
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={saving}
                onClick={() => void saveEntry(false)}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {canRelease && !savedDraft && orderId ? (
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  disabled={saving}
                  onClick={() => void releaseOrder()}
                >
                  Release to doctor
                </button>
              ) : null}
            </>
          ) : null}
        </footer>
      </aside>
    </>
  );
}
