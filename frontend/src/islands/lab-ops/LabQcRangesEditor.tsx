import { useCallback, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { oeFetch } from '@core/oeFetch';
import type { QcRangeValues, QcRuleEditorRow } from './labOpsTypes';

/**
 * D-LAB-QC — admin editor for reference / critical ranges. Each test shows its built-in default and
 * lets a lab lead set a clinic-specific override without a code change. Blank fields fall back to
 * the default; Reset removes the override entirely.
 */
interface LabQcRangesEditorProps {
  ajaxUrl: string;
  csrfToken: string;
}

interface RowDraft {
  warn_min: string;
  warn_max: string;
  crit_min: string;
  crit_max: string;
  reference_range: string;
}

function numToStr(value?: number | null): string {
  return value === null || value === undefined ? '' : String(value);
}

function toDraft(values: QcRangeValues | null): RowDraft {
  return {
    warn_min: numToStr(values?.warn_min),
    warn_max: numToStr(values?.warn_max),
    crit_min: numToStr(values?.crit_min),
    crit_max: numToStr(values?.crit_max),
    reference_range: values?.reference_range ?? '',
  };
}

export function LabQcRangesEditor({ ajaxUrl, csrfToken }: LabQcRangesEditorProps) {
  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<QcRuleEditorRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [loaded, setLoaded] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await oeFetch<{ rows: QcRuleEditorRow[] }>('lab_ops.qc_rules_list', fetchOptions);
      const nextRows = data.rows ?? [];
      setRows(nextRows);
      const nextDrafts: Record<string, RowDraft> = {};
      for (const row of nextRows) {
        nextDrafts[row.procedure_code] = toDraft(row.override ?? row.default);
      }
      setDrafts(nextDrafts);
      setLoaded(true);
    } catch {
      showDeskToast('Could not load reference ranges', 'danger');
    }
  }, [fetchOptions]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next && !loaded) void load();
      return next;
    });
  }, [load, loaded]);

  const updateDraft = useCallback((code: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));
  }, []);

  const save = useCallback(async (code: string) => {
    const draft = drafts[code];
    if (!draft) return;
    setBusyCode(code);
    try {
      await oeFetch('lab_ops.qc_rule_save', {
        ...fetchOptions,
        json: { procedure_code: code, fields: draft },
      });
      showDeskToast('Range saved', 'success');
      await load();
    } catch (err) {
      showDeskToast(err instanceof Error ? err.message : 'Could not save range', 'danger');
    } finally {
      setBusyCode(null);
    }
  }, [drafts, fetchOptions, load]);

  const reset = useCallback(async (code: string) => {
    setBusyCode(code);
    try {
      await oeFetch('lab_ops.qc_rule_reset', {
        ...fetchOptions,
        json: { procedure_code: code },
      });
      showDeskToast('Reset to default', 'info');
      await load();
    } catch (err) {
      showDeskToast(err instanceof Error ? err.message : 'Could not reset range', 'danger');
    } finally {
      setBusyCode(null);
    }
  }, [fetchOptions, load]);

  return (
    <div className={deskCalloutClass('info', 'mb-3')}>
      <button
        type="button"
        className="nc-labops-qc-toggle"
        aria-expanded={open}
        onClick={toggle}
      >
        <strong>Reference &amp; critical ranges</strong>
        <span className="text-[var(--oe-nc-text-muted)] text-sm ml-2">
          {open ? 'Hide' : 'Tune QC ranges'}
        </span>
      </button>

      {open ? (
        <div className="mt-2">
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">
            Blank fields use the built-in default. Critical values flag urgent results; they never
            block a release.
          </p>
          {!loaded ? (
            <div className="text-sm text-[var(--oe-nc-text-muted)]">Loading…</div>
          ) : (
            <div className="nc-labops-qc-grid">
              {rows.map((row) => {
                const draft = drafts[row.procedure_code];
                if (!draft) return null;
                const d = row.default;
                return (
                  <div key={row.procedure_code} className="nc-labops-qc-row">
                    <div className="nc-labops-qc-name">
                      <strong>{row.label}</strong>
                      {row.units ? (
                        <span className="text-[var(--oe-nc-text-muted)]"> · {row.units}</span>
                      ) : null}
                      {row.has_override ? (
                        <Badge variant="warning" className="ml-2">Custom</Badge>
                      ) : (
                        <Badge variant="neutral" className="ml-2">Default</Badge>
                      )}
                      <div className="text-[var(--oe-nc-text-muted)] text-sm">
                        Default: ref {numToStr(d.warn_min) || '—'}–{numToStr(d.warn_max) || '—'},
                        {' '}critical {numToStr(d.crit_min) || '—'}/{numToStr(d.crit_max) || '—'}
                      </div>
                    </div>
                    <div className="nc-labops-qc-fields">
                      <label>
                        Ref low
                        <Input
                          className="h-8"
                          inputMode="decimal"
                          value={draft.warn_min}
                          onChange={(e) => updateDraft(row.procedure_code, { warn_min: e.target.value })}
                        />
                      </label>
                      <label>
                        Ref high
                        <Input
                          className="h-8"
                          inputMode="decimal"
                          value={draft.warn_max}
                          onChange={(e) => updateDraft(row.procedure_code, { warn_max: e.target.value })}
                        />
                      </label>
                      <label>
                        Crit low
                        <Input
                          className="h-8"
                          inputMode="decimal"
                          value={draft.crit_min}
                          onChange={(e) => updateDraft(row.procedure_code, { crit_min: e.target.value })}
                        />
                      </label>
                      <label>
                        Crit high
                        <Input
                          className="h-8"
                          inputMode="decimal"
                          value={draft.crit_max}
                          onChange={(e) => updateDraft(row.procedure_code, { crit_max: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="nc-labops-qc-actions">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyCode === row.procedure_code}
                        onClick={() => void save(row.procedure_code)}
                      >
                        Save
                      </Button>
                      {row.has_override ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyCode === row.procedure_code}
                          onClick={() => void reset(row.procedure_code)}
                        >
                          Reset
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
