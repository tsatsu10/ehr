import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSharedDeviceSession } from './useSharedDeviceSession';

vi.mock('./oeFetch', () => ({
  oeFetch: vi.fn(),
}));

import { oeFetch } from './oeFetch';

const mockFetch = oeFetch as ReturnType<typeof vi.fn>;
const KEY = 'triage_desk_active_visit_id';

const baseOpts = {
  enabled: true,
  ajaxUrl: '/mock/ajax',
  csrfToken: 'token',
  facilityId: 1,
  storageKey: KEY,
  compareMode: 'clinical' as const,
  restoreAction: 'triage.restore_session',
};

describe('useSharedDeviceSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetch.mockResolvedValue({ enabled: true, mismatch: false });
  });

  afterEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it('does not probe when disabled', async () => {
    renderHook(() => useSharedDeviceSession({ ...baseOpts, enabled: false }));
    await waitFor(() => expect(mockFetch).not.toHaveBeenCalled());
  });

  it('probes when a visit id is stored', async () => {
    sessionStorage.setItem(KEY, '99');
    mockFetch.mockResolvedValue({
      enabled: true,
      mismatch: true,
      session: { pid: 1, display_name: 'Session Patient', pubpid: 'MRN1' },
      visit: { visit_id: 99, queue_number: 3, display_name: 'Desk Patient', pubpid: 'MRN2' },
    });

    const { result } = renderHook(() => useSharedDeviceSession(baseOpts));

    await waitFor(() => expect(result.current.blocked).toBe(true));
    expect(result.current.probeData?.visit?.display_name).toBe('Desk Patient');
  });

  it('clears banner when probe reports no mismatch', async () => {
    sessionStorage.setItem(KEY, '99');
    mockFetch.mockResolvedValueOnce({
      enabled: true,
      mismatch: true,
      visit: { visit_id: 99, queue_number: 1, display_name: 'A', pubpid: 'X' },
    }).mockResolvedValueOnce({ enabled: true, mismatch: false });

    const { result } = renderHook(() => useSharedDeviceSession(baseOpts));
    await waitFor(() => expect(result.current.blocked).toBe(true));

    await act(async () => {
      await result.current.probe();
    });

    await waitFor(() => expect(result.current.blocked).toBe(false));
  });

  it('calls restore action and clears blocked state', async () => {
    sessionStorage.setItem(KEY, '99');
    mockFetch
      .mockResolvedValueOnce({
        enabled: true,
        mismatch: true,
        visit: { visit_id: 99, queue_number: 1, display_name: 'A', pubpid: 'X' },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ enabled: true, mismatch: false });

    const onSessionRestored = vi.fn();
    const { result } = renderHook(() =>
      useSharedDeviceSession({ ...baseOpts, onSessionRestored })
    );

    await waitFor(() => expect(result.current.blocked).toBe(true));

    await act(async () => {
      await result.current.restoreSession();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'triage.restore_session',
      expect.objectContaining({ method: 'POST' })
    );
    expect(onSessionRestored).toHaveBeenCalled();
  });
});
