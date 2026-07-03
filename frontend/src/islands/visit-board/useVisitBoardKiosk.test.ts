import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisitBoardKiosk } from './useVisitBoardKiosk';

describe('useVisitBoardKiosk', () => {
  const release = vi.fn();

  beforeEach(() => {
    release.mockReset();
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: vi.fn().mockResolvedValue({ release }),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests wake lock when enabled', async () => {
    renderHook(() => useVisitBoardKiosk(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
  });

  it('does not request wake lock when disabled', async () => {
    renderHook(() => useVisitBoardKiosk(false));
    await act(async () => {
      await Promise.resolve();
    });
    expect(navigator.wakeLock.request).not.toHaveBeenCalled();
  });

  it('tracks fullscreen state from document events', () => {
    const { result } = renderHook(() => useVisitBoardKiosk(true));

    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        value: document.documentElement,
      });
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    expect(result.current.isFullscreen).toBe(true);
  });
});
