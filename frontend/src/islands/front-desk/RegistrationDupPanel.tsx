import { DeskAlert } from '@components/DeskAlert';
import type { RegistrationDupResult } from '@core/types';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { ExternalLink } from 'lucide-react';

interface RegistrationDupPanelProps {
  dup: RegistrationDupResult;
  dupConfirm: boolean;
  dupOverride: boolean;
  dupOverrideReason: string;
  onDupConfirmChange: (checked: boolean) => void;
  onDupOverrideChange: (checked: boolean) => void;
  onDupOverrideReasonChange: (value: string) => void;
  onUseExisting: (pid: number) => void;
  mergeToolBaseUrl?: string;
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
  mergeToolBaseUrl,
}: RegistrationDupPanelProps) {
  if (!dup || dup.level === 'none') return null;

  const tone = dup.level === 'block' ? 'error' : 'warn';
  const title = dup.level === 'block' ? 'Likely match found' : 'Possible duplicate';

  return (
    <DeskAlert tone={tone} className="mb-2" id="nc-dup-panel">
      <strong>{title}</strong>
      <ul className="mb-2 list-disc pl-5">
        {(dup.candidates ?? []).map((candidate) => (
          <li key={candidate.pid} className="mb-1">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="nc-use-existing-patient h-auto p-0"
              onClick={() => onUseExisting(candidate.pid)}
            >
              {candidate.display_name} · MRN {candidate.pubpid} (score {candidate.score})
            </Button>
          </li>
        ))}
      </ul>
      {dup.level === 'block' && mergeToolBaseUrl && dup.candidates && dup.candidates.length >= 2 && (
        <p className="text-xs mb-2">
          <a
            href={`${mergeToolBaseUrl}?action=find&dup1=${dup.candidates[0].pid}&dup2=${dup.candidates[1].pid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline font-medium"
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            Open merge tool
          </a>
          {' '}to permanently merge duplicate records.
        </p>
      )}
      {dup.level === 'warn' ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            id="nc-dup-confirm"
            checked={dupConfirm}
            onCheckedChange={(checked) => onDupConfirmChange(checked === true)}
          />
          Different patient — confirmed
        </label>
      ) : (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="nc-dup-override-reason">Override reason</Label>
            <Input
              id="nc-dup-override-reason"
              maxLength={255}
              value={dupOverrideReason}
              onChange={(e) => onDupOverrideReasonChange(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              id="nc-dup-override"
              checked={dupOverride}
              onCheckedChange={(checked) => onDupOverrideChange(checked === true)}
            />
            Create despite duplicate (lead only)
          </label>
        </div>
      )}
    </DeskAlert>
  );
}
