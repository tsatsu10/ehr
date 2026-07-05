import { useEffect, useState } from 'react';
import type { AssignableDoctor, VisitState } from '@core/types';
import { hardAssignVisit, isHardAssignableVisitState } from '@core/hardAssignVisit';
import { HardAssignDoctorSelect } from '@components/HardAssignDoctorSelect';
import { showDeskToast } from '@components/deskToast';
import { DeskAlert } from '@components/DeskAlert';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { AlertCircle, Loader2, UserRound } from 'lucide-react';

interface ActiveVisitHardAssignProps {
  visitId: number;
  rowVersion: number;
  state: VisitState;
  currentProviderId?: number;
  currentProviderName?: string;
  doctors: AssignableDoctor[];
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  onSaved: () => void;
}

export function ActiveVisitHardAssign({
  visitId,
  rowVersion,
  state,
  currentProviderId,
  currentProviderName,
  doctors,
  ajaxUrl,
  csrfToken,
  facilityId,
  onSaved,
}: ActiveVisitHardAssignProps) {
  const [doctorId, setDoctorId] = useState(
    currentProviderId != null && currentProviderId > 0 ? String(currentProviderId) : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDoctorId(currentProviderId != null && currentProviderId > 0 ? String(currentProviderId) : '');
    setError(null);
  }, [visitId, currentProviderId, rowVersion]);

  if (!isHardAssignableVisitState(state)) {
    return null;
  }

  const parsed = doctorId ? Number.parseInt(doctorId, 10) : 0;
  const nextProviderId = parsed > 0 ? parsed : null;
  const currentValue = currentProviderId != null && currentProviderId > 0 ? currentProviderId : null;
  const isDirty = nextProviderId !== currentValue;

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await hardAssignVisit({
        ajaxUrl,
        csrfToken,
        facilityId,
        visitId,
        rowVersion,
        hardAssignedProviderId: nextProviderId,
      });
      showDeskToast('Doctor assignment saved.', 'success');
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Assignment failed';
      setError(message);
      showDeskToast(message, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeskAlert
      tone="info"
      className="mb-3"
      id="nc-active-visit-hard-assign"
    >
      <div className="flex items-center gap-2 mb-2">
        <UserRound className="h-4 w-4 text-[var(--oe-nc-text-muted)]" aria-hidden />
        <strong className="text-sm font-semibold">Assign doctor</strong>
      </div>
      {currentProviderName && (
        <div className="text-xs text-[var(--oe-nc-text-muted)] mb-2">
          Currently assigned: {currentProviderName}
        </div>
      )}
      <div className="mb-3 space-y-1">
        <Label htmlFor="nc-fd-hard-assign-doctor" className="text-sm">
          Doctor (optional)
        </Label>
        <HardAssignDoctorSelect
          id="nc-fd-hard-assign-doctor"
          doctors={doctors}
          value={doctorId}
          disabled={submitting}
          onChange={setDoctorId}
        />
      </div>
      {error && (
        <DeskAlert
          tone="error"
          className="mb-3 rounded-md px-3 py-2 flex items-start gap-2 text-sm"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>{error}</span>
        </DeskAlert>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!isDirty || submitting}
        onClick={() => void handleSave()}
      >
        {submitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </>
        ) : (
          'Save assignment'
        )}
      </Button>
    </DeskAlert>
  );
}
