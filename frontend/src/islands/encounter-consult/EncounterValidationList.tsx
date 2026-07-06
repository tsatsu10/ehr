import type { EncounterValidationIssue } from './encounterNoteValidation';

interface EncounterValidationListProps {
  errors: EncounterValidationIssue[];
}

export function EncounterValidationList({ errors }: EncounterValidationListProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <ul className="mt-3 space-y-1 rounded-lg border border-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_30%,var(--oe-nc-border))] bg-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_6%,var(--oe-nc-surface,#fff))] p-3 text-sm text-[var(--color-oe-danger,#b91c1c)]">
      {errors.map((error) => (
        <li key={`${error.section}-${error.field}`}>{error.message}</li>
      ))}
    </ul>
  );
}
