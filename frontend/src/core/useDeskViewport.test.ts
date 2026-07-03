import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useDeskViewport } from './useDeskViewport';

function mockMatchMedia(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });

  return vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('max-width: 767px')
      ? width <= 767
      : query.includes('max-width: 991px')
        ? width <= 991
        : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('useDeskViewport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns mobile at 767px', () => {
    window.matchMedia = mockMatchMedia(767);
    const { result } = renderHook(() => useDeskViewport());
    expect(result.current).toBe('mobile');
  });

  it('returns tablet at 768px', () => {
    window.matchMedia = mockMatchMedia(768);
    const { result } = renderHook(() => useDeskViewport());
    expect(result.current).toBe('tablet');
  });

  it('returns desktop at 992px', () => {
    window.matchMedia = mockMatchMedia(992);
    const { result } = renderHook(() => useDeskViewport());
    expect(result.current).toBe('desktop');
  });
});
