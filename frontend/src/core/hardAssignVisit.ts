import { oeFetch } from '@core/oeFetch';

export async function hardAssignVisit(params: {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  visitId: number;
  rowVersion: number;
  hardAssignedProviderId: number | null;
}): Promise<void> {
  const { ajaxUrl, csrfToken, facilityId, visitId, rowVersion, hardAssignedProviderId } = params;
  await oeFetch('visit.hard_assign', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    json: {
      visit_id: visitId,
      row_version: rowVersion,
      hard_assigned_provider_id: hardAssignedProviderId,
    },
    params: facilityId > 0 ? { facility_id: facilityId } : undefined,
  });
}

/** Visit states where front desk may set hard_assigned_provider_id (§6.5.3). */
export const HARD_ASSIGNABLE_VISIT_STATES = [
  'waiting',
  'in_triage',
  'ready_for_doctor',
] as const;

export function isHardAssignableVisitState(state: string): boolean {
  return (HARD_ASSIGNABLE_VISIT_STATES as readonly string[]).includes(state);
}
