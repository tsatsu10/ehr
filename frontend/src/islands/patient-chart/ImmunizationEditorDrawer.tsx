import { useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  sheetBodyClass,
  sheetWidthClass,
} from '@components/ui/sheet';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { oeFetch } from '@core/oeFetch';
import type { ImmunizationEditorData, VaccineOption } from './patientChartTypes';

/**
 * D-IMM-1 — native immunization editor. Records a shot (Ghana EPI vaccine set) to the canonical
 * immunizations table, replacing the stock immunizations.php form when the flag is on.
 */

interface ImmunizationEditorDrawerProps {
  open: boolean;
  pid: number;
  /** 0 = add new; >0 = edit that shot. */
  shotId: number;
  ajaxUrl: string;
  csrfToken: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ImmunizationEditorDrawer({
  open,
  pid,
  shotId,
  ajaxUrl,
  csrfToken,
  onClose,
  onSaved,
}: ImmunizationEditorDrawerProps) {
  const [vaccines, setVaccines] = useState<VaccineOption[]>([]);
  const [vaccineId, setVaccineId] = useState('');
  const [date, setDate] = useState('');
  const [lot, setLot] = useState('');
  const [note, setNote] = useState('');
  const [givenElsewhere, setGivenElsewhere] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opts = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  useEffect(() => {
    if (!open) return;
    setVaccineId('');
    setDate('');
    setLot('');
    setNote('');
    setGivenElsewhere(false);
    setError(null);

    let cancelled = false;
    setLoading(true);
    const optionsReq = oeFetch<{ vaccines: VaccineOption[] }>('patients.chart.immunization_options', {
      ...opts,
      params: { pid },
    });
    const shotReq =
      shotId > 0
        ? oeFetch<ImmunizationEditorData>('patients.chart.immunization_get', { ...opts, params: { pid, id: shotId } })
        : Promise.resolve(null);

    Promise.all([optionsReq, shotReq])
      .then(([o, shot]) => {
        if (cancelled) return;
        setVaccines(o.vaccines ?? []);
        if (shot) {
          setVaccineId(shot.vaccine_id ?? '');
          setDate(shot.administered_date ?? '');
          setLot(shot.lot_number ?? '');
          setNote(shot.note ?? '');
          setGivenElsewhere(!!shot.given_elsewhere);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the vaccine form.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, shotId, pid, opts]);

  // Preserve a pre-existing (non-EPI) vaccine so editing an old shot doesn't lose it.
  const hasKnownVaccine = vaccines.some((v) => v.id === vaccineId);

  const save = async () => {
    if (vaccineId === '') {
      setError('Choose a vaccine.');
      return;
    }
    if (date === '') {
      setError('Enter the date the vaccine was given.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await oeFetch('patients.chart.immunization_save', {
        ...opts,
        params: { pid },
        json: {
          immunization: {
            id: shotId,
            vaccine_id: vaccineId,
            administered_date: date.trim(),
            lot_number: lot.trim(),
            note: note.trim(),
            given_elsewhere: givenElsewhere,
          },
        },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className={sheetWidthClass.md} aria-labelledby="nc-immun-editor-title">
        <SheetHeader>
          <SheetTitle id="nc-immun-editor-title">{shotId > 0 ? 'Edit immunization' : 'Add immunization'}</SheetTitle>
        </SheetHeader>
        <div className={sheetBodyClass}>
          {loading ? (
            <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading…</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-immun-vaccine">Vaccine</Label>
                <NativeSelect id="nc-immun-vaccine" value={vaccineId} onChange={(e) => setVaccineId(e.target.value)}>
                  <option value="">Choose a vaccine</option>
                  {vaccines.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                  {vaccineId !== '' && !hasKnownVaccine && (
                    <option value={vaccineId}>Current vaccine</option>
                  )}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-immun-date">Date given</Label>
                <Input id="nc-immun-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={givenElsewhere} onCheckedChange={(c) => setGivenElsewhere(c === true)} />
                Given at another clinic
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="nc-immun-lot">Lot number</Label>
                <Input id="nc-immun-lot" maxLength={100} value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-immun-note">Note</Label>
                <Textarea id="nc-immun-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
              </div>
              {error && (
                <div className={deskCalloutClass('error', 'text-sm')} id="nc-immun-error" role="alert">{error}</div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--oe-nc-border)] p-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" id="nc-immun-save" disabled={saving || loading} onClick={() => { void save(); }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
