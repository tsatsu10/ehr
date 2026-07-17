import { useCallback, useEffect, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';

interface EyeExamMeta {
  acuity_values: string[];
  antseg_findings: Record<string, string>;
  fundus_findings: Record<string, string>;
  iop_methods: Record<string, string>;
}

interface EyeExamPayload {
  enabled: boolean;
  visit_id: number;
  exam_id: number | null;
  values: Record<string, unknown>;
  saved: boolean;
  locked?: boolean;
  meta: EyeExamMeta;
}

interface EyeExamDrawerProps {
  open: boolean;
  onClose: () => void;
  ajaxUrl: string;
  csrfToken: string;
  visitId: number | null;
  patientLabel: string;
  onSaved: () => void;
}

type Values = Record<string, string | number | boolean | string[]>;

// Same anti-flood pattern as the other native drawers.
const examCache = new Map<number, EyeExamPayload>();
const inflightGets = new Map<number, Promise<EyeExamPayload>>();

/** Test hook — module-level caches would otherwise leak between test cases. */
export function clearEyeExamCachesForTest(): void {
  examCache.clear();
  inflightGets.clear();
}

/**
 * Primary-care eye exam drawer — acuity in 6/x notation per eye, pupils/RAPD,
 * optional IOP, quick-pick anterior-segment and fundus findings ("not examined"
 * is honest data), optional spectacle Rx, impression + refer flag.
 */
export function EyeExamDrawer({
  open,
  onClose,
  ajaxUrl,
  csrfToken,
  visitId,
  patientLabel,
  onSaved,
}: EyeExamDrawerProps) {
  const [meta, setMeta] = useState<EyeExamMeta | null>(null);
  const [values, setValues] = useState<Values>({});
  const [showRx, setShowRx] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const dirtyRef = useRef(false);

  const applyPayload = useCallback((data: EyeExamPayload) => {
    setMeta(data.meta);
    setLocked(!!data.locked);
    if (!dirtyRef.current) {
      const v = (data.values ?? {}) as Values;
      // A fresh exam defaults pupils to the normal finding — otherwise a quick
      // exam would silently record "not equal/reactive" by omission.
      if (!data.saved && v.pupils_equal_reactive === undefined) {
        v.pupils_equal_reactive = true;
      }
      setValues(v);
      setShowRx(Boolean(v.rx_sph_r || v.rx_sph_l));
    }
  }, []);

  useEffect(() => {
    if (!open || !visitId) return;
    let cancelled = false;
    dirtyRef.current = false;
    setError(null);

    const cached = examCache.get(visitId);
    if (cached) {
      applyPayload(cached);
      setLoading(false);
    } else {
      setLoading(true);
      setMeta(null);
      setValues({});
    }

    let request = inflightGets.get(visitId);
    if (!request) {
      request = oeFetch<EyeExamPayload>('clinical_doc.eye_exam_get', {
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
        examCache.set(visitId, data);
        if (cancelled) return;
        applyPayload(data);
      } catch (err) {
        if (!cancelled && !examCache.get(visitId)) {
          setError(err instanceof Error ? err.message : 'Could not load the eye exam.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, visitId, ajaxUrl, csrfToken, applyPayload]);

  const setField = useCallback((field: string, value: Values[string]) => {
    dirtyRef.current = true;
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleFinding = useCallback((field: string, code: string) => {
    dirtyRef.current = true;
    setValues((prev) => {
      const list = Array.isArray(prev[field]) ? [...(prev[field] as string[])] : [];
      const idx = list.indexOf(code);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(code);
      return { ...prev, [field]: list };
    });
  }, []);

  const save = useCallback(async () => {
    if (!visitId) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await oeFetch<{ refer: boolean }>('clinical_doc.eye_exam_save', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId, values },
      });
      examCache.delete(visitId);
      showDeskToast(
        saved.refer ? 'Eye exam saved — remember to write the referral letter' : 'Eye exam saved',
        'success',
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the eye exam.');
    } finally {
      setSaving(false);
    }
  }, [visitId, values, ajaxUrl, csrfToken, onSaved]);

  const str = (f: string): string => String(values[f] ?? '');
  const bool = (f: string): boolean => Boolean(values[f]);
  const list = (f: string): string[] => (Array.isArray(values[f]) ? (values[f] as string[]) : []);

  const acuitySelect = (field: string, label: string) => (
    <div className="space-y-1" key={field}>
      <Label htmlFor={`nc-eye-${field}`} className="text-xs">{label}</Label>
      <NativeSelect
        id={`nc-eye-${field}`}
        value={str(field)}
        onChange={(e) => setField(field, e.target.value)}
        disabled={locked}
      >
        <option value="">—</option>
        {(meta?.acuity_values ?? []).map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </NativeSelect>
    </div>
  );

  const findingChips = (field: string, catalog: Record<string, string>) => (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(catalog).map(([code, label]) => {
        const selected = list(field).includes(code);
        return (
          <button
            key={code}
            type="button"
            className={`nc-scrn-sev nc-eye-chip${selected ? ' is-selected' : ''}`}
            aria-pressed={selected}
            onClick={() => toggleFinding(field, code)}
            disabled={locked}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  const section = (title: string, children: React.ReactNode) => (
    <fieldset className="nc-scrn-item">
      <legend className="nc-scrn-question"><span className="nc-scrn-question-text">{title}</span></legend>
      {children}
    </fieldset>
  );

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      dismissOnOutsideClick={false}
      title="Eye exam"
      id="nc-eye-exam-editor"
      width="lg"
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={bool('refer')}
              onChange={(e) => setField('refer', e.target.checked)}
              disabled={locked}
            />
            <span>Refer to eye specialist</span>
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void save();
              }}
              disabled={saving || loading || locked}
            >
              {saving ? 'Saving…' : 'Save eye exam'}
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
          This eye exam is signed — read only. Unlock the encounter to amend it.
        </div>
      )}

      {loading || !meta ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading eye exam…</p>
      ) : (
        <div>
          {section('Visual acuity', (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="grid grid-cols-3 gap-2">
                <p className="col-span-3 m-0 text-xs font-semibold text-[var(--oe-nc-text-muted)]">RIGHT EYE</p>
                {acuitySelect('acuity_r_unaided', 'Unaided')}
                {acuitySelect('acuity_r_pinhole', 'Pinhole')}
                {acuitySelect('acuity_r_corrected', 'Corrected')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <p className="col-span-3 m-0 text-xs font-semibold text-[var(--oe-nc-text-muted)]">LEFT EYE</p>
                {acuitySelect('acuity_l_unaided', 'Unaided')}
                {acuitySelect('acuity_l_pinhole', 'Pinhole')}
                {acuitySelect('acuity_l_corrected', 'Corrected')}
              </div>
            </div>
          ))}

          {section('Pupils', (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bool('pupils_equal_reactive')}
                    onChange={(e) => setField('pupils_equal_reactive', e.target.checked)}
                    disabled={locked}
                  />
                  <span>Equal &amp; reactive</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={bool('rapd_r')} onChange={(e) => setField('rapd_r', e.target.checked)} disabled={locked} />
                  <span>RAPD right</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={bool('rapd_l')} onChange={(e) => setField('rapd_l', e.target.checked)} disabled={locked} />
                  <span>RAPD left</span>
                </label>
              </div>
              <Input
                value={str('pupils_note')}
                onChange={(e) => setField('pupils_note', e.target.value)}
                placeholder="Pupils note (optional)"
                aria-label="Pupils note"
                disabled={locked}
              />
            </div>
          ))}

          {section('Eye pressure (mmHg)', (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="nc-eye-iop_r" className="text-xs">Right</Label>
                <Input id="nc-eye-iop_r" type="number" inputMode="decimal" step="0.5" value={str('iop_r')} onChange={(e) => setField('iop_r', e.target.value)} disabled={locked} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-eye-iop_l" className="text-xs">Left</Label>
                <Input id="nc-eye-iop_l" type="number" inputMode="decimal" step="0.5" value={str('iop_l')} onChange={(e) => setField('iop_l', e.target.value)} disabled={locked} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-eye-iop_method" className="text-xs">Method</Label>
                <NativeSelect id="nc-eye-iop_method" value={str('iop_method')} onChange={(e) => setField('iop_method', e.target.value)} disabled={locked}>
                  <option value="">—</option>
                  {Object.entries(meta.iop_methods).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          ))}

          {section('Anterior segment', (
            <div className="space-y-2">
              <p className="m-0 text-xs font-semibold text-[var(--oe-nc-text-muted)]">RIGHT EYE</p>
              {findingChips('antseg_r', meta.antseg_findings)}
              <p className="m-0 text-xs font-semibold text-[var(--oe-nc-text-muted)]">LEFT EYE</p>
              {findingChips('antseg_l', meta.antseg_findings)}
              <Input
                value={str('antseg_note')}
                onChange={(e) => setField('antseg_note', e.target.value)}
                placeholder="Anterior segment note (optional)"
                aria-label="Anterior segment note"
                disabled={locked}
              />
            </div>
          ))}

          {section('Fundus', (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={bool('fundus_examined_r')} onChange={(e) => setField('fundus_examined_r', e.target.checked)} disabled={locked} />
                  <span>Right examined</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={bool('fundus_examined_l')} onChange={(e) => setField('fundus_examined_l', e.target.checked)} disabled={locked} />
                  <span>Left examined</span>
                </label>
              </div>
              {bool('fundus_examined_r') && (
                <>
                  <p className="m-0 text-xs font-semibold text-[var(--oe-nc-text-muted)]">RIGHT EYE</p>
                  {findingChips('fundus_r', meta.fundus_findings)}
                </>
              )}
              {bool('fundus_examined_l') && (
                <>
                  <p className="m-0 text-xs font-semibold text-[var(--oe-nc-text-muted)]">LEFT EYE</p>
                  {findingChips('fundus_l', meta.fundus_findings)}
                </>
              )}
              <Input
                value={str('fundus_note')}
                onChange={(e) => setField('fundus_note', e.target.value)}
                placeholder="Fundus note (optional)"
                aria-label="Fundus note"
                disabled={locked}
              />
            </div>
          ))}

          <div className="mb-4">
            <Button type="button" variant="outline" size="sm" aria-expanded={showRx} onClick={() => setShowRx((v) => !v)}>
              {showRx ? 'Hide spectacle prescription' : 'Spectacle prescription…'}
            </Button>
          </div>
          {showRx && section('Spectacle prescription', (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <p className="col-span-4 m-0 text-xs font-semibold text-[var(--oe-nc-text-muted)]">RIGHT: sphere / cylinder / axis / add</p>
                <Input aria-label="Sphere right" placeholder="Sph" value={str('rx_sph_r')} onChange={(e) => setField('rx_sph_r', e.target.value)} disabled={locked} />
                <Input aria-label="Cylinder right" placeholder="Cyl" value={str('rx_cyl_r')} onChange={(e) => setField('rx_cyl_r', e.target.value)} disabled={locked} />
                <Input aria-label="Axis right" placeholder="Axis" type="number" value={str('rx_axis_r')} onChange={(e) => setField('rx_axis_r', e.target.value)} disabled={locked} />
                <Input aria-label="Add right" placeholder="Add" value={str('rx_add_r')} onChange={(e) => setField('rx_add_r', e.target.value)} disabled={locked} />
                <p className="col-span-4 m-0 text-xs font-semibold text-[var(--oe-nc-text-muted)]">LEFT: sphere / cylinder / axis / add</p>
                <Input aria-label="Sphere left" placeholder="Sph" value={str('rx_sph_l')} onChange={(e) => setField('rx_sph_l', e.target.value)} disabled={locked} />
                <Input aria-label="Cylinder left" placeholder="Cyl" value={str('rx_cyl_l')} onChange={(e) => setField('rx_cyl_l', e.target.value)} disabled={locked} />
                <Input aria-label="Axis left" placeholder="Axis" type="number" value={str('rx_axis_l')} onChange={(e) => setField('rx_axis_l', e.target.value)} disabled={locked} />
                <Input aria-label="Add left" placeholder="Add" value={str('rx_add_l')} onChange={(e) => setField('rx_add_l', e.target.value)} disabled={locked} />
              </div>
              <div className="w-32">
                <Label htmlFor="nc-eye-pd" className="text-xs">PD (mm)</Label>
                <Input id="nc-eye-pd" value={str('rx_pd')} onChange={(e) => setField('rx_pd', e.target.value)} disabled={locked} />
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="nc-eye-impression">Impression &amp; plan</Label>
            <Textarea
              id="nc-eye-impression"
              rows={3}
              value={str('impression')}
              onChange={(e) => setField('impression', e.target.value)}
              disabled={locked}
            />
          </div>
        </div>
      )}
    </SlideOver>
  );
}
