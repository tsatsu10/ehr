import type { RegistrationDupResult } from '@core/types';

interface RegistrationDupPanelProps {
  dup: RegistrationDupResult;
  dupConfirm: boolean;
  dupOverride: boolean;
  dupOverrideReason: string;
  onDupConfirmChange: (checked: boolean) => void;
  onDupOverrideChange: (checked: boolean) => void;
  onDupOverrideReasonChange: (value: string) => void;
  onUseExisting: (pid: number) => void;
}

export function RegistrationDupPanel({
  dup,
  dupConfirm,
  dupOverride,
  dupOverrideReason,
  onDupConfirmChange,
  onDupOverrideChange,
  onDupOverrideReasonChange,
  onUseExisting,
}: RegistrationDupPanelProps) {
  if (!dup || dup.level === 'none') return null;

  const alertClass = dup.level === 'block' ? 'alert-danger' : 'alert-warning';
  const title = dup.level === 'block' ? 'Likely match found' : 'Possible duplicate';

  return (
    <div className={`alert ${alertClass} py-2 mb-2`} id="nc-dup-panel">
      <strong>{title}</strong>
      <ul className="mb-2 pl-3">
        {(dup.candidates ?? []).map((candidate) => (
          <li key={candidate.pid} className="mb-1">
            <button
              type="button"
              className="btn btn-link btn-sm p-0 nc-use-existing-patient"
              onClick={() => onUseExisting(candidate.pid)}
            >
              {candidate.display_name} · MRN {candidate.pubpid} (score {candidate.score})
            </button>
          </li>
        ))}
      </ul>
      {dup.level === 'warn' ? (
        <label className="mb-0">
          <input
            type="checkbox"
            id="nc-dup-confirm"
            checked={dupConfirm}
            onChange={(e) => onDupConfirmChange(e.target.checked)}
          />
          {' '}Different patient — confirmed
        </label>
      ) : (
        <div className="form-group mb-0">
          <label htmlFor="nc-dup-override-reason">Override reason</label>
          <input
            type="text"
            className="form-control form-control-sm"
            id="nc-dup-override-reason"
            maxLength={255}
            value={dupOverrideReason}
            onChange={(e) => onDupOverrideReasonChange(e.target.value)}
          />
          <label className="mt-2 mb-0">
            <input
              type="checkbox"
              id="nc-dup-override"
              checked={dupOverride}
              onChange={(e) => onDupOverrideChange(e.target.checked)}
            />
            {' '}Create despite duplicate (lead only)
          </label>
        </div>
      )}
    </div>
  );
}
