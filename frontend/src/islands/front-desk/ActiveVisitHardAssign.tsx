import { useEffect, useState } from 'react';
import type { AssignableDoctor, VisitState } from '@core/types';
import { hardAssignVisit, isHardAssignableVisitState } from '@core/hardAssignVisit';
import { HardAssignDoctorSelect } from '@components/HardAssignDoctorSelect';
import { Button } from '@components/ui/button';
import { Loader2, UserRound } from 'lucide-react';

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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDoctorId(currentProviderId != null && currentProviderId > 0 ? String(currentProviderId) : '');
    setError(null);
    setSaved(false);
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
    setSaved(false);
    try {
      await hardAssignVisit({
        ajaxUrl,
        csrfToken,
        facilityId,
        visitId,
        rowVersion,
        hardAssignedProviderId: nextProviderId,
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="alert alert-light border py-2 mb-3" id="nc-active-visit-hard-assign">
      <div className="d-flex align-items-center mb-2">
        <UserRound className="h-4 w-4 mr-2 text-muted" aria-hidden />
        <strong className="small mb-0">Assign doctor</strong>
      </div>
      {currentProviderName && (
        <div className="small text-muted mb-2">
          Currently assigned: {currentProviderName}
        </div>
      )}
      <div className="form-group mb-2">
        <label htmlFor="nc-fd-hard-assign-doctor" className="small mb-1">
          Doctor (optional)
        </label>
        <HardAssignDoctorSelect
          id="nc-fd-hard-assign-doctor"
          doctors={doctors}
          value={doctorId}
          disabled={submitting}
          onChange={(value) => {
            setDoctorId(value);
            setSaved(false);
          }}
        />
      </div>
      {error && <div className="small text-danger mb-2">{error}</div>}
      {saved && !error && (
        <div className="small text-success mb-2">Doctor assignment saved.</div>
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
    </div>
  );
}
