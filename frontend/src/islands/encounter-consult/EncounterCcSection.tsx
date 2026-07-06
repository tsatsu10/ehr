import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';

interface EncounterCcSectionProps {
  chiefComplaint: string;
  readOnly: boolean;
  onChange: (chiefComplaint: string) => void;
  onFocus?: () => void;
}

export function EncounterCcSection({
  chiefComplaint,
  readOnly,
  onChange,
  onFocus,
}: EncounterCcSectionProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="encounter-cc">Chief complaint</Label>
      <Input
        id="encounter-cc"
        maxLength={500}
        value={chiefComplaint}
        disabled={readOnly}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
      />
    </div>
  );
}
