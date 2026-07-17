import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';

interface VitalsFieldMeta {
  required: string[];
  units: Record<string, string>;
  labels: Record<string, string>;
}

interface VitalsPayload {
  enabled: boolean;
  visit_id: number;
  vitals_id: number | null;
  values: Record<string, string | number>;
  saved: boolean;
  locked?: boolean;
  fields: VitalsFieldMeta;
}

interface VitalsDrawerProps {
  open: boolean;
  onClose: () => void;
  ajaxUrl: string;
  csrfToken: string;
  visitId: number | null;
  patientLabel: string;
  onSaved: () => void;
}

const NUMERIC_FIELDS = [
  'bps', 'bpd', 'pulse', 'respiration', 'temperature',
  'oxygen_saturation', 'weight', 'height', 'waist_circ',
] as const;

// Same anti-flood pattern as the other native drawers: cache per visit for
// instant reopens; at most one GET in flight per visit.
const vitalsCache = new Map<number, VitalsPayload>();
const inflightGets = new Map<number, Promise<VitalsPayload>>();

/** Test hook — module-level caches would otherwise leak between test cases. */
export function clearVitalsCachesForTest(): void {
  vitalsCache.clear();
  inflightGets.clear();
}

/**
 * Native Vitals editor — the default editor for the `vitals` encounter form card
 * (no feature flag). Metric fields, live BMI, edit-in-place of the latest set;
 * writes the canonical form_vitals row via the module's vitals services.
 */
export function VitalsDrawer({
  open,
  onClose,
  ajaxUrl,
  csrfToken,
  visitId,
  patientLabel,
  onSaved,
}: VitalsDrawerProps) {
  const [meta, setMeta] = useState<VitalsFieldMeta | null>(null);
  const [vitalsId, setVitalsId] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // touched drives render-time hints; dirtyRef guards the background refresh
  // (refs must not be read during render).
  const [touched, setTouched] = useState(false);
  const [locked, setLocked] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!open || !visitId) return;
    let cancelled = false;
    dirtyRef.current = false;
    setTouched(false);
    setError(null);

    const toStrings = (vals: Record<string, string | number>): Record<string, string> => {
      const out: Record<string, string> = {};
      Object.entries(vals).forEach(([k, v]) => { out[k] = String(v); });
      return out;
    };

    const cached = vitalsCache.get(visitId);
    if (cached) {
      setMeta(cached.fields);
      setVitalsId(cached.vitals_id);
      setValues(toStrings(cached.values ?? {}));
      setLocked(!!cached.locked);
      setLoading(false);
    } else {
      setLoading(true);
      setMeta(null);
      setValues({});
      setVitalsId(null);
    }

    let request = inflightGets.get(visitId);
    if (!request) {
      request = oeFetch<VitalsPayload>('clinical_doc.vitals_get', {
        ajaxUrl,
        csrfToken,
        params: { visit_id: visitId },
      });
      inflightGets.set(visitId, request);
      void request.catch(() => undefined).then(() => inflightGets.delete(visitId));
    }

    (async () => {
      try {
        const data = await request;
        vitalsCache.set(visitId, data);
        if (cancelled) return;
        setMeta(data.fields);
        setVitalsId(data.vitals_id);
        setLocked(!!data.locked);
        if (!dirtyRef.current) {
          setValues(toStrings(data.values ?? {}));
        }
      } catch (err) {
        if (!cancelled && !vitalsCache.get(visitId)) {
          setError(err instanceof Error ? err.message : 'Could not load vitals.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, visitId, ajaxUrl, csrfToken]);

  const setField = useCallback((field: string, value: string) => {
    dirtyRef.current = true;
    setTouched(true);
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const bmi = useMemo(() => {
    const weight = parseFloat(values.weight ?? '');
    const height = parseFloat(values.height ?? '');
    if (!Number.isFinite(weight) || !Number.isFinite(height) || weight <= 0 || height <= 0) {
      return null;
    }
    const metres = height / 100;
    const value = Math.round((weight / (metres * metres)) * 10) / 10;
    const status = value < 18.5 ? 'Underweight' : value < 25 ? 'Normal' : value < 30 ? 'Overweight' : 'Obese';
    return { value, status };
  }, [values.weight, values.height]);

  const missingRequired = useMemo(() => {
    if (!meta) return [];
    return meta.required.filter((f) => (values[f] ?? '').trim() === '');
  }, [meta, values]);

  const save = useCallback(async () => {
    if (!visitId || missingRequired.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      await oeFetch('clinical_doc.vitals_save', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId, vitals_id: vitalsId ?? undefined, values },
      });
      vitalsCache.delete(visitId);
      showDeskToast('Vitals saved', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vitals.');
    } finally {
      setSaving(false);
    }
  }, [visitId, vitalsId, values, missingRequired, ajaxUrl, csrfToken, onSaved]);

  const numberField = (field: string) => {
    if (!meta) return null;
    const required = meta.required.includes(field);
    const missing = required && (values[field] ?? '').trim() === '' && touched;
    return (
      <div key={field} className="space-y-1.5">
        <Label htmlFor={`nc-vit-${field}`}>
          {meta.labels[field] ?? field}
          {meta.units[field] ? (
            <span className="ml-1 font-normal text-[var(--oe-nc-text-muted)]">({meta.units[field]})</span>
          ) : null}
          {required ? <span aria-hidden="true" className="ml-0.5 text-[var(--oe-nc-danger)]">*</span> : null}
        </Label>
        <Input
          id={`nc-vit-${field}`}
          type="number"
          inputMode="decimal"
          step="any"
          value={values[field] ?? ''}
          onChange={(e) => setField(field, e.target.value)}
          aria-invalid={missing ? true : undefined}
          disabled={locked}
        />
      </div>
    );
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      dismissOnOutsideClick={false}
      title="Vitals"
      id="nc-vitals-editor"
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="nc-scrn-result" aria-live="polite">
            {bmi ? (
              <>
                <span className="nc-scrn-score">BMI {bmi.value}</span>
                <span className={`nc-scrn-sev nc-scrn-sev--${bmi.status === 'Normal' ? 'low' : bmi.status === 'Overweight' ? 'mid' : bmi.status === 'Underweight' ? 'mid' : 'high'}`}>
                  {bmi.status}
                </span>
              </>
            ) : (
              <span className="nc-scrn-progress">Enter weight + height for BMI</span>
            )}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void save();
              }}
              disabled={saving || loading || locked || missingRequired.length > 0}
            >
              {saving ? 'Saving…' : 'Save vitals'}
            </Button>
          </div>
        </div>
      )}
    >
      {patientLabel && (
        <p className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">{patientLabel}</p>
      )}

      {error && <div className={deskCalloutClass('error', 'mb-3 py-2 text-sm')}>{error}</div>}
      {locked && (
        <div className={deskCalloutClass('info', 'mb-3 py-2 text-sm')}>
          This vitals record is signed — read only. Unlock the encounter to amend it.
        </div>
      )}

      {loading || !meta ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading vitals…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {NUMERIC_FIELDS.map((field) => numberField(field))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-vit-note">Note</Label>
            <Textarea
              id="nc-vit-note"
              rows={2}
              value={values.note ?? ''}
              onChange={(e) => setField('note', e.target.value)}
              disabled={locked}
            />
          </div>
        </div>
      )}
    </SlideOver>
  );
}
