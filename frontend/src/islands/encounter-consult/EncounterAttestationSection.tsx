import { Label } from '@components/ui/label';
import { SupervisorCombobox } from '../doctor-desk/SupervisorCombobox';
import type { EncounterNoteSections, EncounterSignMeta, EncounterSupervisorMeta } from './encounterConsultTypes';

interface EncounterAttestationSectionProps {
  sections: EncounterNoteSections;
  supervisor: EncounterSupervisorMeta;
  signMeta?: EncounterSignMeta | null;
  encounterId: number;
  facilityId: number;
  ajaxUrl: string;
  csrfToken: string;
  supervisorRequired: boolean;
  readOnly: boolean;
  onAttestationChange: (attested: boolean) => void;
  onSupervisorUpdated: (meta: EncounterSupervisorMeta) => void;
  onNotice: (message: string, variant: 'success' | 'danger') => void;
}

export function EncounterAttestationSection({
  sections,
  supervisor,
  signMeta,
  encounterId,
  facilityId,
  ajaxUrl,
  csrfToken,
  supervisorRequired,
  readOnly,
  onAttestationChange,
  onSupervisorUpdated,
  onNotice,
}: EncounterAttestationSectionProps) {
  if (readOnly && signMeta) {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <Label>Author</Label>
          <p className="mt-1 text-[var(--oe-nc-text)]">
            {signMeta.author_display_name ?? 'Unknown author'}
            {signMeta.author_role ? ` · ${signMeta.author_role}` : ''}
          </p>
        </div>
        {signMeta.signed_at && (
          <div>
            <Label>Signed</Label>
            <p className="mt-1 text-[var(--oe-nc-text)]">{signMeta.signed_at}</p>
          </div>
        )}
        {supervisor.supervisor_display_name && (
          <div>
            <Label>Supervising provider</Label>
            <p className="mt-1 text-[var(--oe-nc-text)]">{supervisor.supervisor_display_name}</p>
          </div>
        )}
        {sections.attestation.supervisor_attested && (
          <p className="rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-3 py-2 text-[var(--oe-nc-text-muted)]">
            Supervisor attestation recorded for this consult note.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {supervisorRequired && (
        <SupervisorCombobox
          visit={{
            id: 0,
            encounter: encounterId,
            pid: 0,
            queue_number: '',
            state: 'with_doctor',
            row_version: 0,
          }}
          supervisor={supervisor}
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          facilityId={facilityId}
          blocked={readOnly}
          onUpdated={onSupervisorUpdated}
          onNotice={onNotice}
        />
      )}

      {supervisorRequired && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={sections.attestation.supervisor_attested}
            disabled={readOnly}
            onChange={(event) => onAttestationChange(event.target.checked)}
          />
          <span>
            I attest that this consult note was reviewed with my supervising provider
            {supervisor.supervisor_display_name ? ` (${supervisor.supervisor_display_name})` : ''}
          </span>
        </label>
      )}

      {!supervisorRequired && (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">
          Supervisor attestation is not required for this clinic configuration.
        </p>
      )}

      {supervisor.supervisor_display_name && !supervisorRequired && (
        <div className="text-sm">
          <Label>Supervising provider</Label>
          <p className="mt-1 text-[var(--oe-nc-text)]">{supervisor.supervisor_display_name}</p>
        </div>
      )}
    </div>
  );
}
