import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { oeFetch } from '@core/oeFetch';
import { useDoctorRoster } from './useDoctorRoster';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
  OeFetchError: class OeFetchError extends Error {},
}));

const mockedFetch = vi.mocked(oeFetch);

function baseOptions(overrides: Partial<Parameters<typeof useDoctorRoster>[0]> = {}) {
  return {
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    facilityId: 1,
    visitDate: '2026-07-14',
    refreshToken: 0,
    enabled: true,
    ...overrides,
  };
}

describe('useDoctorRoster', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('skips the fetch and clears doctors when disabled', async () => {
    const { result } = renderHook(() => useDoctorRoster(baseOptions({ enabled: false })));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.doctors).toEqual([]);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('loads doctors and identifies self / taking count', async () => {
    mockedFetch.mockResolvedValue({
      enabled: true,
      my_user_id: 5,
      doctors: [
        { user_id: 5, display_name: 'Me', taking_patients: true, queue_load: 2 },
        { user_id: 6, display_name: 'Other', taking_patients: false, queue_load: 0 },
      ],
    } as never);

    const { result } = renderHook(() => useDoctorRoster(baseOptions()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.doctors).toHaveLength(2);
    expect(result.current.self?.display_name).toBe('Me');
    expect(result.current.takingCount).toBe(1);
  });

  it('surfaces a load error and clears doctors', async () => {
    mockedFetch.mockRejectedValue(new Error('roster down'));
    const { result } = renderHook(() => useDoctorRoster(baseOptions()));

    await waitFor(() => expect(result.current.error).toBe('roster down'));
    expect(result.current.doctors).toEqual([]);
  });

  it('toggleTaking posts the new state and updates the row optimistically', async () => {
    mockedFetch.mockResolvedValueOnce({
      enabled: true,
      my_user_id: 5,
      doctors: [{ user_id: 5, display_name: 'Me', taking_patients: false, queue_load: 0 }],
    } as never);
    mockedFetch.mockResolvedValueOnce({} as never);

    const { result } = renderHook(() => useDoctorRoster(baseOptions()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleTaking(true);
    });

    expect(mockedFetch).toHaveBeenLastCalledWith(
      'doctor.roster.set_taking',
      expect.objectContaining({
        method: 'POST',
        json: { user_id: 5, taking_patients: 1, facility_id: 1 },
      }),
    );
    expect(result.current.doctors[0].taking_patients).toBe(true);
  });

  it('does nothing when toggling before my_user_id is known', async () => {
    mockedFetch.mockResolvedValue({ enabled: true, my_user_id: 0, doctors: [] } as never);
    const { result } = renderHook(() => useDoctorRoster(baseOptions()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedFetch.mockClear();
    await act(async () => {
      await result.current.toggleTaking(true);
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
