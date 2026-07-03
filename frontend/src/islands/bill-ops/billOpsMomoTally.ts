const KEY_PREFIX = 'oe-nc-billops-momo';

export function momoTallyStorageKey(facilityId: number, date: string): string {
  return `${KEY_PREFIX}:${facilityId}:${date}`;
}

export function readMomoTally(facilityId: number, date: string): string {
  try {
    return localStorage.getItem(momoTallyStorageKey(facilityId, date)) ?? '';
  } catch {
    return '';
  }
}

export function writeMomoTally(facilityId: number, date: string, value: string): void {
  try {
    const key = momoTallyStorageKey(facilityId, date);
    if (value.trim() === '') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    /* localStorage unavailable */
  }
}
