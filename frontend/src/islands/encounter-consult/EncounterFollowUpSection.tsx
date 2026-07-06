import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { EncounterNoteFollowUpSection } from './encounterConsultTypes';

interface EncounterFollowUpSectionProps {
  section: EncounterNoteFollowUpSection;
  readOnly: boolean;
  onChange: (section: EncounterNoteFollowUpSection) => void;
  onFocus?: () => void;
}

export function EncounterFollowUpSection({
  section,
  readOnly,
  onChange,
  onFocus,
}: EncounterFollowUpSectionProps) {
  const update = (patch: Partial<EncounterNoteFollowUpSection>) => {
    onChange({ ...section, ...patch });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="encounter-follow-up-return">Return visit</Label>
        <Input
          id="encounter-follow-up-return"
          placeholder="e.g. 2 weeks, PRN if worse"
          value={section.return_visit}
          disabled={readOnly}
          onChange={(event) => update({ return_visit: event.target.value })}
          onFocus={onFocus}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="encounter-follow-up-callback">Who calls whom</Label>
        <Input
          id="encounter-follow-up-callback"
          placeholder="e.g. Patient to call clinic if symptoms persist"
          value={section.callback_contact}
          disabled={readOnly}
          onChange={(event) => update({ callback_contact: event.target.value })}
          onFocus={onFocus}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="encounter-follow-up-availability">Availability for questions</Label>
        <Input
          id="encounter-follow-up-availability"
          placeholder="e.g. Ward team weekdays 08:00–16:00"
          value={section.availability}
          disabled={readOnly}
          onChange={(event) => update({ availability: event.target.value })}
          onFocus={onFocus}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="encounter-follow-up-instructions">Follow-up instructions</Label>
        <Textarea
          id="encounter-follow-up-instructions"
          rows={5}
          placeholder="Summarize return precautions, pending results, and communication plan…"
          value={section.instructions}
          disabled={readOnly}
          onChange={(event) => update({ instructions: event.target.value })}
          onFocus={onFocus}
        />
      </div>
    </div>
  );
}
