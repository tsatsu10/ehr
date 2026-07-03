import type { SchedulingFilters, SchedulingLens } from './schedulingTypes';
import { ALL_PROVIDERS_ID } from './schedulingTypes';

/**
 * Build deep links between S1 lenses (PRD S-P5 cross-lens navigation).
 */
export function buildSchedulingLensUrl(
  moduleUrl: string,
  lens: SchedulingLens,
  options: {
    date?: string;
    facilityId?: number;
    providerId?: number;
    pid?: number;
  } = {},
): string {
  const base = moduleUrl.replace(/\/$/, '');
  const params = new URLSearchParams();
  params.set('lens', lens);
  if (options.date) {
    params.set('date', options.date);
  }
  if (options.facilityId != null && options.facilityId > 0) {
    params.set('facility_id', String(options.facilityId));
  }
  if (options.providerId != null && options.providerId > ALL_PROVIDERS_ID) {
    params.set('provider_id', String(options.providerId));
  }
  if (options.pid != null && options.pid > 0) {
    params.set('pid', String(options.pid));
  }

  return `${base}/scheduling/index.php?${params.toString()}`;
}

export function recallsUrlForPatient(
  moduleUrl: string,
  filters: SchedulingFilters,
  pid: number,
): string {
  return buildSchedulingLensUrl(moduleUrl, 'recalls', {
    date: filters.date,
    facilityId: filters.facilityId,
    providerId: filters.providerId,
    pid,
  });
}

export function flowBoardUrlForDate(
  moduleUrl: string,
  filters: SchedulingFilters,
  date: string,
): string {
  return buildSchedulingLensUrl(moduleUrl, 'flow', {
    date,
    facilityId: filters.facilityId,
    providerId: filters.providerId,
  });
}

export function calendarUrlForDate(
  moduleUrl: string,
  filters: SchedulingFilters,
  date: string,
): string {
  return buildSchedulingLensUrl(moduleUrl, 'calendar', {
    date,
    facilityId: filters.facilityId,
    providerId: filters.providerId,
  });
}
