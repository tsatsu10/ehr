import { useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  sheetBodyClass,
  sheetWidthClass,
} from '@components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@components/ui/accordion';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { oeFetch } from '@core/oeFetch';
import type { HistoryEditorData } from './patientChartTypes';

/**
 * D-HIST-9/10 — native Background/history editor. A West-Africa-first field set that writes
 * the canonical history record. Permanent replacement for stock history_full.php.
 *  - Quick mode (D-HIST-9): the fields staff touch daily.
 *  - Full mode (D-HIST-10): a superset adding WHO-PEN risk factors, sleep, and the
 *    sensitive family conditions behind a reveal.
 */

type Mode = 'quick' | 'full';

type ConditionKey = keyof HistoryEditorData['family_conditions'];

interface BackgroundEditorDrawerProps {
  open: boolean;
  pid: number;
  ajaxUrl: string;
  csrfToken: string;
  onClose: () => void;
  onSaved: () => void;
}

// West-Africa-first ordering: sickle cell leads, then the common chronic-disease clustering.
const COMMON_CONDITIONS: { key: ConditionKey; label: string }[] = [
  { key: 'sickle_cell', label: 'Sickle cell / G6PD' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'stroke', label: 'Stroke' },
  { key: 'heart', label: 'Heart problems' },
  { key: 'tuberculosis', label: 'Tuberculosis' },
  { key: 'cancer', label: 'Cancer' },
  { key: 'epilepsy', label: 'Epilepsy' },
];
const MENTAL_ILLNESS: { key: ConditionKey; label: string } = { key: 'mental_illness', label: 'Mental illness' };
// Sensitive items — kept behind an "Add more" reveal in full mode.
const SENSITIVE_CONDITIONS: { key: ConditionKey; label: string }[] = [
  MENTAL_ILLNESS,
  { key: 'suicide', label: 'Suicide' },
];

// WHO-PEN-aligned risk factors (full mode). See FULL_HISTORY_FORM_REDESIGN §3.5.
const RISK_FACTORS: { key: string; label: string }[] = [
  { key: 'tobacco', label: 'Tobacco use (current or former)' },
  { key: 'alcohol', label: 'Harmful alcohol use' },
  { key: 'inactivity', label: 'Physical inactivity' },
  { key: 'obesity', label: 'Overweight / obesity' },
  { key: 'hypertension', label: 'Known high blood pressure' },
  { key: 'diabetes', label: 'Known diabetes' },
  { key: 'fh_cvd', label: 'Family history of heart disease, stroke, or diabetes' },
  { key: 'sickle', label: 'Sickle cell trait or disease' },
  { key: 'hiv', label: 'HIV positive' },
  { key: 'tb', label: 'Previous TB or TB contact' },
  { key: 'pregnancy', label: 'High-risk pregnancy' },
  { key: 'herbal', label: 'Herbal / traditional medicine use' },
];

// Fixed answer sets for the lifestyle dropdowns. Stored as the label text in the free-text
// column, so a value typed via the stock form still round-trips (kept as a custom option).
const LIFESTYLE_OPTIONS: Record<string, string[]> = {
  tobacco: ['Never', 'Former', 'Current'],
  alcohol: ['Never', 'Occasional', 'Regular'],
  recreational_drugs: ['None', 'Former', 'Current'],
  exercise: ['Rarely', 'Sometimes', 'Often'],
};

/** A labelled dropdown that preserves any pre-existing free-text value not in the option set. */
function LifestyleSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const custom = value && !options.includes(value) ? value : null;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not recorded</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {custom && <option value={custom}>{custom}</option>}
      </NativeSelect>
    </div>
  );
}

function ConditionCheckbox({
  cond,
  checked,
  onChange,
}: {
  cond: { key: ConditionKey; label: string };
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      {cond.label}
    </label>
  );
}

function emptyForm(): HistoryEditorData {
  return {
    text: {
      family_mother: '',
      family_father: '',
      family_siblings: '',
      tobacco: '',
      alcohol: '',
      recreational_drugs: '',
      exercise: '',
      herbal_medicine: '',
      occupation: '',
      past_medical_history: '',
      last_hb: '',
      sleep: '',
    },
    family_conditions: {
      sickle_cell: false,
      hypertension: false,
      diabetes: false,
      heart: false,
      stroke: false,
      tuberculosis: false,
      cancer: false,
      epilepsy: false,
      mental_illness: false,
      suicide: false,
    },
    dates: { last_bp_date: '', last_glucose_date: '' },
    risk_factors: [],
    risk_other: '',
  };
}

export function BackgroundEditorDrawer({
  open,
  pid,
  ajaxUrl,
  csrfToken,
  onClose,
  onSaved,
}: BackgroundEditorDrawerProps) {
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState<Mode>('quick');
  const [showSensitive, setShowSensitive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opts = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const isFull = mode === 'full';

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setMode('quick');
    setShowSensitive(false);
    setError(null);

    let cancelled = false;
    setLoading(true);
    oeFetch<HistoryEditorData>('patients.chart.history_get', { ...opts, params: { pid } })
      .then((d) => {
        if (cancelled) return;
        const base = emptyForm();
        setForm({
          text: { ...base.text, ...(d.text ?? {}) },
          family_conditions: { ...base.family_conditions, ...(d.family_conditions ?? {}) },
          dates: { ...base.dates, ...(d.dates ?? {}) },
          risk_factors: d.risk_factors ?? [],
          risk_other: d.risk_other ?? '',
        });
        // If the record already carries sensitive family history, reveal it so it's visible.
        if (d.family_conditions?.mental_illness || d.family_conditions?.suicide) {
          setShowSensitive(true);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load background.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pid, opts]);

  const setText = (key: keyof HistoryEditorData['text'], value: string) =>
    setForm((f) => ({ ...f, text: { ...f.text, [key]: value } }));
  const setCondition = (key: ConditionKey, value: boolean) =>
    setForm((f) => ({ ...f, family_conditions: { ...f.family_conditions, [key]: value } }));
  const setDate = (key: keyof HistoryEditorData['dates'], value: string) =>
    setForm((f) => ({ ...f, dates: { ...f.dates, [key]: value } }));
  const toggleRisk = (key: string, on: boolean) =>
    setForm((f) => ({
      ...f,
      risk_factors: on ? [...new Set([...f.risk_factors, key])] : f.risk_factors.filter((k) => k !== key),
    }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await oeFetch('patients.chart.history_save', {
        ...opts,
        params: { pid },
        json: { background: form },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const gridConditions = isFull ? COMMON_CONDITIONS : [...COMMON_CONDITIONS, MENTAL_ILLNESS];

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className={sheetWidthClass.lg} aria-labelledby="nc-history-editor-title">
        <SheetHeader>
          <SheetTitle id="nc-history-editor-title">{isFull ? 'Edit full history' : 'Edit background'}</SheetTitle>
        </SheetHeader>
        <div className={sheetBodyClass}>
          {loading ? (
            <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading…</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">
                Record the patient&apos;s long-term background. Fill in what you know — leave the rest
                blank and come back later.
              </p>
              <Accordion type="multiple" defaultValue={['family', 'social']}>
                <AccordionItem value="family">
                  <AccordionTrigger>Family health</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-xs text-[var(--oe-nc-text-muted)]">
                        Health problems close relatives have or had — <strong>not their names</strong>.
                        This helps spot conditions that run in the family.
                      </p>
                      <div className="space-y-1.5">
                        <Label htmlFor="nc-hist-mother">Mother</Label>
                        <Input id="nc-hist-mother" value={form.text.family_mother} onChange={(e) => setText('family_mother', e.target.value)} placeholder="e.g. High blood pressure, diabetes" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="nc-hist-father">Father</Label>
                        <Input id="nc-hist-father" value={form.text.family_father} onChange={(e) => setText('family_father', e.target.value)} placeholder="e.g. Stroke, heart problems" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="nc-hist-siblings">Brothers &amp; sisters</Label>
                        <Input id="nc-hist-siblings" value={form.text.family_siblings} onChange={(e) => setText('family_siblings', e.target.value)} placeholder="e.g. Sickle cell disease" />
                      </div>
                      <fieldset className="space-y-2">
                        <legend className="text-sm text-[var(--oe-nc-text-muted)]">Tick any a close relative has had</legend>
                        <div className="grid grid-cols-2 gap-2">
                          {gridConditions.map((cond) => (
                            <ConditionCheckbox
                              key={cond.key}
                              cond={cond}
                              checked={form.family_conditions[cond.key]}
                              onChange={(v) => setCondition(cond.key, v)}
                            />
                          ))}
                        </div>
                        {isFull && !showSensitive && (
                          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setShowSensitive(true)}>
                            Add mental health history
                          </Button>
                        )}
                        {isFull && showSensitive && (
                          <div className="grid grid-cols-2 gap-2 border-t border-[var(--oe-nc-border)] pt-2">
                            {SENSITIVE_CONDITIONS.map((cond) => (
                              <ConditionCheckbox
                                key={cond.key}
                                cond={cond}
                                checked={form.family_conditions[cond.key]}
                                onChange={(v) => setCondition(cond.key, v)}
                              />
                            ))}
                          </div>
                        )}
                      </fieldset>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="social">
                  <AccordionTrigger>Social &amp; lifestyle</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-xs text-[var(--oe-nc-text-muted)]">
                        The patient&apos;s own habits and work.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <LifestyleSelect id="nc-hist-tobacco" label="Tobacco" value={form.text.tobacco} options={LIFESTYLE_OPTIONS.tobacco} onChange={(v) => setText('tobacco', v)} />
                        <LifestyleSelect id="nc-hist-alcohol" label="Alcohol" value={form.text.alcohol} options={LIFESTYLE_OPTIONS.alcohol} onChange={(v) => setText('alcohol', v)} />
                        <LifestyleSelect id="nc-hist-drugs" label="Recreational drugs" value={form.text.recreational_drugs} options={LIFESTYLE_OPTIONS.recreational_drugs} onChange={(v) => setText('recreational_drugs', v)} />
                        <LifestyleSelect id="nc-hist-exercise" label="Exercise" value={form.text.exercise} options={LIFESTYLE_OPTIONS.exercise} onChange={(v) => setText('exercise', v)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="nc-hist-herbal">Herbal / traditional medicine</Label>
                        <Input id="nc-hist-herbal" maxLength={250} value={form.text.herbal_medicine} onChange={(e) => setText('herbal_medicine', e.target.value)} placeholder="e.g. Herbal mix for malaria, monthly" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="nc-hist-occupation">Occupation</Label>
                        <Input id="nc-hist-occupation" maxLength={250} value={form.text.occupation} onChange={(e) => setText('occupation', e.target.value)} placeholder="e.g. Trader, farmer, teacher" />
                      </div>
                      {isFull && (
                        <div className="space-y-1.5">
                          <Label htmlFor="nc-hist-sleep">Sleep</Label>
                          <Input id="nc-hist-sleep" value={form.text.sleep} onChange={(e) => setText('sleep', e.target.value)} placeholder="e.g. Sleeps well / Poor sleep" />
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="pmh">
                  <AccordionTrigger>Past illnesses</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1.5">
                      <Label htmlFor="nc-hist-pmh">Past illnesses, surgeries, and hospital stays</Label>
                      <Textarea id="nc-hist-pmh" rows={4} value={form.text.past_medical_history} onChange={(e) => setText('past_medical_history', e.target.value)} placeholder="e.g. Malaria last year. Appendix removed in 2019." />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {isFull && (
                  <AccordionItem value="risk">
                    <AccordionTrigger>Risk factors</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        <p className="text-xs text-[var(--oe-nc-text-muted)]">
                          Tick anything that raises the patient&apos;s health risk.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {RISK_FACTORS.map((rf) => (
                            <label key={rf.key} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={form.risk_factors.includes(rf.key)}
                                onCheckedChange={(c) => toggleRisk(rf.key, c === true)}
                              />
                              {rf.label}
                            </label>
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="nc-hist-risk-other">Other</Label>
                          <Input id="nc-hist-risk-other" maxLength={250} value={form.risk_other} onChange={(e) => setForm((f) => ({ ...f, risk_other: e.target.value }))} placeholder="Anything not listed" />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value="screening">
                  <AccordionTrigger>Recent health checks</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-xs text-[var(--oe-nc-text-muted)]">
                        When these were last done, if known.
                      </p>
                      <div className="space-y-1.5">
                        <Label htmlFor="nc-hist-hb">Last blood (Hb) or sickle test</Label>
                        <Input id="nc-hist-hb" maxLength={250} value={form.text.last_hb} onChange={(e) => setText('last_hb', e.target.value)} placeholder="e.g. 11 g/dL, Jan 2026" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="nc-hist-bp">Last blood pressure check</Label>
                          <Input id="nc-hist-bp" type="date" value={form.dates.last_bp_date} onChange={(e) => setDate('last_bp_date', e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="nc-hist-glucose">Last blood sugar check</Label>
                          <Input id="nc-hist-glucose" type="date" value={form.dates.last_glucose_date} onChange={(e) => setDate('last_glucose_date', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}
          {error && (
            <div className={deskCalloutClass('error', 'text-sm mt-3')} id="nc-history-error" role="alert">{error}</div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--oe-nc-border)] p-4">
          <div className="flex items-center gap-3">
            {isFull ? (
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setMode('quick')}>
                ← Quick edit
              </Button>
            ) : (
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setMode('full')}>
                Full form →
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="button" id="nc-history-save" disabled={saving || loading} onClick={() => { void save(); }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
