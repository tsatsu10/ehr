import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import type { EncounterNoteReferralSection } from './encounterConsultTypes';
import { URGENCY_OPTIONS } from './encounterVariants';

interface EncounterReferralSectionProps {
  section: EncounterNoteReferralSection;
  readOnly: boolean;
  onChange: (section: EncounterNoteReferralSection) => void;
  onFocus?: () => void;
}

export function EncounterReferralSection({
  section,
  readOnly,
  onChange,
  onFocus,
}: EncounterReferralSectionProps) {
  const update = (patch: Partial<EncounterNoteReferralSection>) => {
    onChange({ ...section, ...patch });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="encounter-referring-clinician">Requesting clinician</Label>
        <Input
          id="encounter-referring-clinician"
          value={section.requesting_clinician}
          disabled={readOnly}
          onChange={(event) => update({ requesting_clinician: event.target.value })}
          onFocus={onFocus}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="encounter-referring-service">Requesting service</Label>
        <Input
          id="encounter-referring-service"
          value={section.requesting_service}
          disabled={readOnly}
          onChange={(event) => update({ requesting_service: event.target.value })}
          onFocus={onFocus}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="encounter-clinical-question">Clinical question</Label>
        <Textarea
          id="encounter-clinical-question"
          rows={4}
          value={section.clinical_question}
          disabled={readOnly}
          onChange={(event) => update({ clinical_question: event.target.value })}
          onFocus={onFocus}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="encounter-urgency">Urgency</Label>
        <Select
          value={section.urgency || 'routine'}
          disabled={readOnly}
          onValueChange={(value) => update({
            urgency: value as EncounterNoteReferralSection['urgency'],
          })}
        >
          <SelectTrigger id="encounter-urgency">
            <SelectValue placeholder="Select urgency" />
          </SelectTrigger>
          <SelectContent>
            {URGENCY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
