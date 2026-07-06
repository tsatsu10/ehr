import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { HPI_PROMPTS, type EncounterNoteHpiSection } from './encounterConsultTypes';

interface EncounterHpiSectionProps {
  section: EncounterNoteHpiSection;
  readOnly: boolean;
  onChange: (section: EncounterNoteHpiSection) => void;
  onFocus?: () => void;
}

export function EncounterHpiSection({
  section,
  readOnly,
  onChange,
  onFocus,
}: EncounterHpiSectionProps) {
  const update = (patch: Partial<EncounterNoteHpiSection>) => {
    onChange({ ...section, ...patch });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {HPI_PROMPTS.map((prompt) => (
          <div className="space-y-2" key={prompt.key}>
            <Label htmlFor={`encounter-hpi-${prompt.key}`}>{prompt.label}</Label>
            <Input
              id={`encounter-hpi-${prompt.key}`}
              placeholder={prompt.placeholder}
              value={section[prompt.key]}
              disabled={readOnly}
              onChange={(event) => update({ [prompt.key]: event.target.value })}
              onFocus={onFocus}
            />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="encounter-hpi">History of present illness</Label>
        <Textarea
          id="encounter-hpi"
          rows={8}
          placeholder="Summarize the interval history and clinical reasoning…"
          value={section.narrative}
          disabled={readOnly}
          onChange={(event) => update({ narrative: event.target.value })}
          onFocus={onFocus}
        />
      </div>
    </div>
  );
}
