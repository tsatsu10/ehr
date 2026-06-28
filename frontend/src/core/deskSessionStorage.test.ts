import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clearDeskActiveVisitId,
  getDeskActiveVisitId,
  setDeskActiveVisitId,
} from './deskSessionStorage';

const KEY = 'triage_desk_active_visit_id';

describe('deskSessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns 0 when no visit is stored', () => {
    expect(getDeskActiveVisitId(KEY)).toBe(0);
  });

  it('stores and reads active visit id', () => {
    setDeskActiveVisitId(KEY, 42);
    expect(getDeskActiveVisitId(KEY)).toBe(42);
  });

  it('clears stored visit id', () => {
    setDeskActiveVisitId(KEY, 42);
    clearDeskActiveVisitId(KEY);
    expect(getDeskActiveVisitId(KEY)).toBe(0);
  });

  it('ignores invalid visit ids', () => {
    setDeskActiveVisitId(KEY, 0);
    expect(getDeskActiveVisitId(KEY)).toBe(0);
  });
});
