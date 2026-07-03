import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  markDoctorReadyToastSeen,
  pickDoctorReadyNotice,
  wasDoctorReadyToastSeen,
} from './doctorReadyToast';

describe('doctorReadyToast', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('shows one notice per visit and dedupes via sessionStorage', () => {
    const pending = [{ visit_id: 42, display_name: 'Kwame Mensah', queue_number: 'A-12' }];
    const first = pickDoctorReadyNotice(pending, true);
    expect(first?.message).toContain('Kwame Mensah');
    expect(wasDoctorReadyToastSeen(42)).toBe(true);

    const second = pickDoctorReadyNotice(pending, true);
    expect(second).toBeNull();
  });

  it('returns null when disabled', () => {
    const pending = [{ visit_id: 1, display_name: 'Test', queue_number: 1 }];
    expect(pickDoctorReadyNotice(pending, false)).toBeNull();
  });

  it('markDoctorReadyToastSeen is safe when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => markDoctorReadyToastSeen(9)).not.toThrow();
    spy.mockRestore();
  });
});
