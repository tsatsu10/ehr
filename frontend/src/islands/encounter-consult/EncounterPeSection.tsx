import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { EncounterNotePeSection, EncounterSpecialtyPeOverlay } from './encounterConsultTypes';

interface EncounterPeSectionProps {
  section: EncounterNotePeSection;
  overlays: EncounterSpecialtyPeOverlay[];
  readOnly: boolean;
  onChange: (section: EncounterNotePeSection) => void;
  onFocus: () => void;
}

export function EncounterPeSection({
  section,
  overlays,
  readOnly,
  onChange,
  onFocus,
}: EncounterPeSectionProps) {
  const updateSpecialty = (overlayId: string, text: string) => {
    onChange({
      ...section,
      specialty: {
        ...section.specialty,
        [overlayId]: text,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="encounter-pe-general">General physical examination</Label>
        <Textarea
          id="encounter-pe-general"
          rows={8}
          value={section.general}
          disabled={readOnly}
          onChange={(event) => onChange({ ...section, general: event.target.value })}
          onFocus={onFocus}
        />
      </div>
      {overlays.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium mb-0">Specialty overlays</p>
          {overlays.map((overlay) => (
            <div key={overlay.id} className="space-y-2">
              <Label htmlFor={`encounter-pe-${overlay.id}`}>{overlay.label}</Label>
              <Textarea
                id={`encounter-pe-${overlay.id}`}
                rows={4}
                placeholder={`${overlay.label} findings…`}
                value={section.specialty[overlay.id] ?? ''}
                disabled={readOnly}
                onChange={(event) => updateSpecialty(overlay.id, event.target.value)}
                onFocus={onFocus}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
