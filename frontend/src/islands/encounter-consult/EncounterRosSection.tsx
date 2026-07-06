import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import type { EncounterNoteRosSection } from './encounterConsultTypes';
import {
  ROS_FINDING_STATUSES,
  rosStatusLabel,
  type RosFindingStatus,
  type RosSystemName,
} from './encounterRosSystems';

interface EncounterRosSectionProps {
  section: EncounterNoteRosSection;
  systems: readonly RosSystemName[];
  readOnly: boolean;
  onChange: (section: EncounterNoteRosSection) => void;
  onFocus: () => void;
}

function rowForSystem(
  section: EncounterNoteRosSection,
  system: RosSystemName,
): { status: RosFindingStatus; notes: string } {
  const existing = section.systems.find((row) => row.system === system);
  return {
    status: existing?.status ?? 'not_reviewed',
    notes: existing?.notes ?? '',
  };
}

export function EncounterRosSection({
  section,
  systems,
  readOnly,
  onChange,
  onFocus,
}: EncounterRosSectionProps) {
  const updateSystem = (system: RosSystemName, patch: Partial<{ status: RosFindingStatus; notes: string }>) => {
    const current = rowForSystem(section, system);
    const nextRow = {
      system,
      status: patch.status ?? current.status,
      notes: patch.notes ?? current.notes,
    };
    const others = section.systems.filter((row) => row.system !== system);
    onChange({
      ...section,
      systems: [...others, nextRow],
    });
  };

  const markAllNegative = () => {
    onChange({
      ...section,
      systems: systems.map((system) => ({
        system,
        status: 'negative' as const,
        notes: '',
      })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">
          Document pertinent positives and negatives. Use <strong>Negative</strong> for reviewed systems without symptoms.
        </p>
        {!readOnly && (
          <button
            type="button"
            className="text-sm text-[var(--oe-nc-link,#2563eb)] underline-offset-2 hover:underline"
            onClick={markAllNegative}
          >
            Mark all reviewed negative
          </button>
        )}
      </div>
      <div className="space-y-3">
        {systems.map((system) => {
          const row = rowForSystem(section, system);
          return (
            <div
              key={system}
              className="grid gap-2 rounded-lg border border-[var(--oe-nc-border)] p-3 md:grid-cols-[minmax(140px,180px)_160px_1fr]"
            >
              <div className="font-medium text-sm">{system}</div>
              <Select
                value={row.status}
                disabled={readOnly}
                onValueChange={(value) => updateSystem(system, { status: value as RosFindingStatus })}
              >
                <SelectTrigger aria-label={`${system} ROS status`} onFocus={onFocus}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROS_FINDING_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{rosStatusLabel(status)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                className="flex h-9 w-full rounded-md border border-[var(--oe-nc-border)] bg-transparent px-3 py-1 text-sm"
                placeholder="Notes (optional)"
                value={row.notes}
                disabled={readOnly || row.status === 'not_reviewed'}
                onChange={(event) => updateSystem(system, { notes: event.target.value })}
                onFocus={onFocus}
              />
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        <Label htmlFor="encounter-ros-narrative">Additional ROS narrative</Label>
        <Textarea
          id="encounter-ros-narrative"
          rows={4}
          placeholder="Summarize pertinent positives/negatives not captured above…"
          value={section.narrative}
          disabled={readOnly}
          onChange={(event) => onChange({ ...section, narrative: event.target.value })}
          onFocus={onFocus}
        />
      </div>
    </div>
  );
}
