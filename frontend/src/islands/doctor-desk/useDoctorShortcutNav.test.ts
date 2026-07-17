import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDoctorShortcutNav } from './useDoctorShortcutNav';
import * as doctorShortcutNav from './doctorShortcutNav';

vi.mock('./doctorShortcutNav', async () => {
  const actual = await vi.importActual<typeof import('./doctorShortcutNav')>('./doctorShortcutNav');
  return {
    ...actual,
    doctorShortcutPreflight: vi.fn(),
    navigateDoctorShortcut: vi.fn(),
  };
});

const mockedPreflight = vi.mocked(doctorShortcutNav.doctorShortcutPreflight);
const mockedNavigate = vi.mocked(doctorShortcutNav.navigateDoctorShortcut);

const visit = { id: 7, pid: 12, encounter: 99, queue_number: '3', state: 'with_doctor', row_version: 1 } as never;

function baseOptions(overrides: Partial<Parameters<typeof useDoctorShortcutNav>[0]> = {}) {
  return {
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    preview: null,
    visit,
    onError: vi.fn(),
    ...overrides,
  };
}

describe('useDoctorShortcutNav', () => {
  beforeEach(() => {
    mockedPreflight.mockReset();
    mockedNavigate.mockReset();
  });

  it('does nothing when there is no active visit', async () => {
    const { result } = renderHook(() => useDoctorShortcutNav(baseOptions({ visit: null })));
    await act(async () => {
      await result.current.runShortcut('encounter');
    });
    expect(mockedPreflight).not.toHaveBeenCalled();
  });

  it('preflights then navigates for a normal shortcut', async () => {
    mockedPreflight.mockResolvedValue({ redirect_url: '/encounter/7' });
    const { result } = renderHook(() => useDoctorShortcutNav(baseOptions()));

    await act(async () => {
      await result.current.runShortcut('encounter');
    });

    expect(mockedPreflight).toHaveBeenCalledWith('/ajax.php', 'tok', 7, 'encounter', undefined);
    expect(mockedNavigate).toHaveBeenCalledWith(7, 'encounter', '/encounter/7');
  });

  it('reports a plain error via onError for non-allergy failures', async () => {
    mockedPreflight.mockRejectedValue(new Error('boom'));
    const onError = vi.fn();
    const { result } = renderHook(() => useDoctorShortcutNav(baseOptions({ onError })));

    await act(async () => {
      await result.current.runShortcut('encounter');
    });

    expect(onError).toHaveBeenCalledWith('boom');
    expect(result.current.rxOverrideOpen).toBe(false);
  });

  it('opens the allergy override modal instead of erroring when Rx hits an undocumented-allergy 409', async () => {
    const { OeFetchError } = await import('@core/oeFetch');
    mockedPreflight.mockRejectedValue(
      new OeFetchError('Document allergies', 409, doctorShortcutNav.ALLERGIES_UNDOCUMENTED_CODE),
    );
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useDoctorShortcutNav(baseOptions({ canRxAllergyOverride: true, onError })),
    );

    await act(async () => {
      await result.current.runShortcut('rx');
    });

    expect(result.current.rxOverrideOpen).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not open the override modal when canRxAllergyOverride is false', async () => {
    const { OeFetchError } = await import('@core/oeFetch');
    mockedPreflight.mockRejectedValue(
      new OeFetchError('Document allergies', 409, doctorShortcutNav.ALLERGIES_UNDOCUMENTED_CODE),
    );
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useDoctorShortcutNav(baseOptions({ canRxAllergyOverride: false, onError })),
    );

    await act(async () => {
      await result.current.runShortcut('rx');
    });

    expect(result.current.rxOverrideOpen).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it('confirmRxOverride re-runs the shortcut with the override reason and closes the modal on success', async () => {
    mockedPreflight.mockResolvedValue({ redirect_url: '/rx/7' });
    const { result } = renderHook(() => useDoctorShortcutNav(baseOptions({ canRxAllergyOverride: true })));

    await act(async () => {
      await result.current.confirmRxOverride('Patient confirmed verbally');
    });

    expect(mockedPreflight).toHaveBeenCalledWith('/ajax.php', 'tok', 7, 'rx', {
      rxUndocumentedAllergyOverrideReason: 'Patient confirmed verbally',
    });
    expect(result.current.rxOverrideOpen).toBe(false);
    expect(result.current.rxOverrideSubmitting).toBe(false);
  });

  it('confirmRxOverride surfaces its own error without closing the modal', async () => {
    mockedPreflight.mockRejectedValue(new Error('still blocked'));
    const { result } = renderHook(() => useDoctorShortcutNav(baseOptions()));

    await act(async () => {
      await result.current.confirmRxOverride('reason');
    });

    expect(result.current.rxOverrideError).toBe('still blocked');
    expect(result.current.rxOverrideSubmitting).toBe(false);
  });

  it('closeRxOverride is a no-op while submitting', async () => {
    const { result } = renderHook(() => useDoctorShortcutNav(baseOptions()));
    act(() => {
      result.current.closeRxOverride();
    });
    expect(result.current.rxOverrideOpen).toBe(false);
  });
});
