import { Checkbox } from '@components/ui/checkbox';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { EncounterLabResultPrefillItem, EncounterNoteDataReviewedSection } from './encounterConsultTypes';

interface EncounterDataReviewedSectionProps {
  section: EncounterNoteDataReviewedSection;
  recentLabs: EncounterLabResultPrefillItem[];
  readOnly: boolean;
  onChange: (section: EncounterNoteDataReviewedSection) => void;
  onFocus: () => void;
}

export function EncounterDataReviewedSection({
  section,
  recentLabs,
  readOnly,
  onChange,
  onFocus,
}: EncounterDataReviewedSectionProps) {
  const toggleLab = (labId: string, checked: boolean) => {
    const next = checked
      ? [...section.lab_ids, labId]
      : section.lab_ids.filter((id) => id !== labId);
    onChange({ ...section, lab_ids: Array.from(new Set(next)) });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Recent lab results</Label>
        {recentLabs.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-[var(--oe-nc-border)] p-3">
            {recentLabs.map((lab) => (
              <label key={lab.id} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={section.lab_ids.includes(lab.id)}
                  disabled={readOnly}
                  onCheckedChange={(checked) => toggleLab(lab.id, checked === true)}
                />
                <span>
                  <span className="font-medium">{lab.label}</span>
                  {lab.date ? <span className="text-[var(--oe-nc-text-muted)]"> · {lab.date}</span> : null}
                  {lab.abnormal ? (
                    <span className="ml-1 text-[var(--color-oe-danger,#b91c1c)]">Abnormal</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">No reviewed lab results in the last 90 days.</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="encounter-imaging-reviewed">Imaging reviewed</Label>
        <Textarea
          id="encounter-imaging-reviewed"
          rows={3}
          placeholder="Summarize imaging reviewed for this consult…"
          value={section.imaging_narrative}
          disabled={readOnly}
          onChange={(event) => onChange({ ...section, imaging_narrative: event.target.value })}
          onFocus={onFocus}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="encounter-outside-records">Outside records</Label>
        <Textarea
          id="encounter-outside-records"
          rows={3}
          placeholder="Referral packet, outside hospital records, prior consult notes…"
          value={section.outside_records}
          disabled={readOnly}
          onChange={(event) => onChange({ ...section, outside_records: event.target.value })}
          onFocus={onFocus}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="encounter-data-reviewed-narrative">Data reviewed summary</Label>
        <Textarea
          id="encounter-data-reviewed-narrative"
          rows={4}
          placeholder="Optional narrative tying reviewed data to clinical decision-making…"
          value={section.narrative}
          disabled={readOnly}
          onChange={(event) => onChange({ ...section, narrative: event.target.value })}
          onFocus={onFocus}
        />
      </div>
    </div>
  );
}
