import { useEffect, useMemo, useState } from 'react';
import { SlideOver } from '@components/SlideOver';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';

export interface PatientEducationResource {
  title: string;
  /** URL template with a `[%]` placeholder for the search term. */
  url: string;
}

interface PatientEducationSlideOverProps {
  open: boolean;
  onClose: () => void;
  resources: PatientEducationResource[];
  /** Optional seed for the search box (e.g. the visit's chief complaint). */
  seedTerm?: string;
}

/**
 * B3 (G7) — Doctor Desk patient-education quick action. Opens a clinic-configured
 * education website (external_patient_education list) with the typed term injected
 * where the resource's URL has `[%]`. New tab, so the consult stays put.
 */
export function PatientEducationSlideOver({
  open,
  onClose,
  resources,
  seedTerm = '',
}: PatientEducationSlideOverProps) {
  const [resourceIdx, setResourceIdx] = useState(0);
  const [term, setTerm] = useState('');

  useEffect(() => {
    if (open) {
      setResourceIdx(0);
      setTerm(seedTerm);
    }
  }, [open, seedTerm]);

  const selected = resources[resourceIdx] ?? null;
  const canOpen = useMemo(() => selected !== null && term.trim() !== '', [selected, term]);

  const openHandout = () => {
    if (!selected || term.trim() === '') return;
    const url = selected.url.includes('[%]')
      ? selected.url.replace('[%]', encodeURIComponent(term.trim()))
      : selected.url;
    // Only ever open web links — guard against a mis-entered or unsafe scheme
    // (e.g. javascript:) in the admin-configured resource list.
    if (!/^https?:\/\//i.test(url)) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      id="nc-doctor-education"
      title="Patient handouts"
      width="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Close</Button>
          <Button type="button" size="sm" disabled={!canOpen} onClick={openHandout}>
            Open handout
          </Button>
        </div>
      }
    >
      {resources.length === 0 ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">
          No education resources are configured. An administrator can add them to the
          “external_patient_education” list.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">
            Search a configured resource for a condition and open the handout in a new tab.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="nc-doctor-education-resource">Resource</Label>
            <NativeSelect
              id="nc-doctor-education-resource"
              value={String(resourceIdx)}
              onChange={(e) => setResourceIdx(Number.parseInt(e.target.value, 10) || 0)}
            >
              {resources.map((r, i) => (
                <option key={`${r.title}-${i}`} value={String(i)}>{r.title}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-doctor-education-term">Condition or topic</Label>
            <Input
              id="nc-doctor-education-term"
              value={term}
              placeholder="e.g. hypertension, malaria, diabetes"
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canOpen) openHandout(); }}
            />
          </div>
        </div>
      )}
    </SlideOver>
  );
}
