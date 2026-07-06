import { Checkbox } from '@components/ui/checkbox';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { EncounterNoteSourceSection } from './encounterConsultTypes';
import { SOURCE_OF_INFORMATION_OPTIONS } from './encounterVariants';

interface EncounterSourceSectionProps {
  section: EncounterNoteSourceSection;
  readOnly: boolean;
  onChange: (section: EncounterNoteSourceSection) => void;
  onFocus?: () => void;
}

export function EncounterSourceSection({
  section,
  readOnly,
  onChange,
  onFocus,
}: EncounterSourceSectionProps) {
  const toggleSource = (source: string, checked: boolean) => {
    const next = checked
      ? [...section.sources, source]
      : section.sources.filter((value) => value !== source);
    onChange({ ...section, sources: next });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-2">
        {SOURCE_OF_INFORMATION_OPTIONS.map((source) => (
          <label key={source} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={section.sources.includes(source)}
              disabled={readOnly}
              onCheckedChange={(checked) => toggleSource(source, checked === true)}
            />
            <span>{source}</span>
          </label>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="encounter-source-narrative">Additional narrative</Label>
        <Textarea
          id="encounter-source-narrative"
          rows={4}
          value={section.narrative}
          disabled={readOnly}
          onChange={(event) => onChange({ ...section, narrative: event.target.value })}
          onFocus={onFocus}
        />
      </div>
    </div>
  );
}
