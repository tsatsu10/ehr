import { Button } from '@components/ui/button';
import type { EncounterBackgroundPrefill, EncounterNotePrefill } from './encounterConsultTypes';

interface EncounterBackgroundSectionProps {
  prefill: EncounterNotePrefill;
}

function BackgroundBlock({
  title,
  lines,
  emptyLabel,
  editUrl,
}: {
  title: string;
  lines: Array<{ label: string; value: string }>;
  emptyLabel: string;
  editUrl?: string | null;
}) {
  return (
    <div className="rounded-lg border border-[var(--oe-nc-border)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold mb-0">{title}</h4>
        {editUrl ? (
          <Button variant="outline" size="sm" asChild>
            <a href={editUrl} target="_top" rel="noreferrer">
              Edit
            </a>
          </Button>
        ) : null}
      </div>
      {lines.length > 0 ? (
        <ul className="mb-0 pl-4 list-disc text-sm text-[var(--oe-nc-text-muted)]">
          {lines.map((line) => (
            <li key={`${line.label}-${line.value}`}>
              {line.label !== line.value ? `${line.label}: ${line.value}` : line.value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">{emptyLabel}</p>
      )}
    </div>
  );
}

export function EncounterBackgroundSection({ prefill }: EncounterBackgroundSectionProps) {
  const background: EncounterBackgroundPrefill = prefill.background ?? {
    problems: [],
    social: [],
    edit_urls: {},
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">
        Read-only summary from the patient chart. Use Edit links to update underlying records.
      </p>
      <BackgroundBlock
        title="Problems / PMH"
        lines={background.problems}
        emptyLabel="No active problems documented."
        editUrl={background.edit_urls.problems}
      />
      <BackgroundBlock
        title="Allergies"
        lines={prefill.allergies.summary
          ? [{ label: 'Summary', value: prefill.allergies.summary }]
          : prefill.allergies.items.map((item) => ({ label: 'Allergy', value: item }))}
        emptyLabel={prefill.allergies.undocumented ? 'Allergies not documented.' : 'No known allergies recorded.'}
        editUrl={prefill.allergies.edit_url}
      />
      <BackgroundBlock
        title="Medications"
        lines={(prefill.medications.items ?? []).map((item) => ({ label: 'Medication', value: item }))}
        emptyLabel="No medications on file."
        editUrl={prefill.medications.edit_url}
      />
      <BackgroundBlock
        title="Social / family history"
        lines={background.social}
        emptyLabel="No social or family history documented."
        editUrl={background.edit_urls.history}
      />
    </div>
  );
}
