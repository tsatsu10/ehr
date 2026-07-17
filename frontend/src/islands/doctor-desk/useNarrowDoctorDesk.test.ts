import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNarrowDoctorDesk } from './useNarrowDoctorDesk';

function mockMatchMedia(initialMatches: boolean) {
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  const mql = {
    matches: initialMatches,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return {
    fire(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((cb) => cb({ matches }));
    },
  };
}

describe('useNarrowDoctorDesk', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reflects the initial matchMedia state', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useNarrowDoctorDesk());
    expect(result.current).toBe(true);
  });

  it('updates when the media query change fires', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useNarrowDoctorDesk());
    expect(result.current).toBe(false);

    act(() => {
      media.fire(true);
    });
    expect(result.current).toBe(true);
  });
});
