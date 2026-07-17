import { t } from '@core/i18n';
import type { DoctorDeskNotice } from './doctorDeskUtils';

const STORAGE_PREFIX = 'nc-doctor-ready-toast-seen:';

export function wasDoctorReadyToastSeen(visitId: number): boolean {
  if (visitId <= 0) {
    return true;
  }
  try {
    return window.sessionStorage.getItem(`${STORAGE_PREFIX}${visitId}`) === '1';
  } catch {
    return false;
  }
}

export function markDoctorReadyToastSeen(visitId: number): void {
  if (visitId <= 0) {
    return;
  }
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${visitId}`, '1');
  } catch {
    // sessionStorage unavailable
  }
}

export interface DoctorReadyNotifyItem {
  visit_id: number;
  display_name: string;
  queue_number: string | number;
}

export function pickDoctorReadyNotice(
  pending: DoctorReadyNotifyItem[],
  enabled: boolean,
): DoctorDeskNotice | null {
  if (!enabled) {
    return null;
  }

  for (const item of pending) {
    if (item.visit_id <= 0 || wasDoctorReadyToastSeen(item.visit_id)) {
      continue;
    }

    markDoctorReadyToastSeen(item.visit_id);
    return {
      message: t('Patient ready: {name} (queue #{queueNumber}).', {
        name: item.display_name,
        queueNumber: item.queue_number,
      }),
      variant: 'info',
    };
  }

  return null;
}
