import { describe, expect, it } from 'vitest';
import { HARD_ASSIGNABLE_VISIT_STATES, isHardAssignableVisitState } from './hardAssignVisit';

describe('isHardAssignableVisitState', () => {
  it('allows pre-doctor queue states', () => {
    for (const state of HARD_ASSIGNABLE_VISIT_STATES) {
      expect(isHardAssignableVisitState(state)).toBe(true);
    }
  });

  it('rejects with_doctor and terminal states', () => {
    expect(isHardAssignableVisitState('with_doctor')).toBe(false);
    expect(isHardAssignableVisitState('completed')).toBe(false);
    expect(isHardAssignableVisitState('cancelled')).toBe(false);
  });
});
