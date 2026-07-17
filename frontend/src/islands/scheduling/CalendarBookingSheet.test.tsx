import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { CalendarBookingSheet } from './CalendarBookingSheet';
import { bookCalendarAppointment } from './schedulingApi';
import type { CalendarBookingDraft, CalendarDayPayload } from './schedulingTypes';

const fetchFreeSlotsMock = vi.fn().mockResolvedValue({ slots: ['09:15', '09:30'], interval_minutes: 15 });

vi.mock('./schedulingApi', () => ({
  bookCalendarAppointment: vi.fn().mockResolvedValue({}),
  fetchFreeSlots: (...args: unknown[]) => fetchFreeSlotsMock(...args),
}));

vi.mock('@components/PatientSearchDropdown', () => ({
  // Exposes a real button so tests can drive onSelectPatient(pid, row) —
  // a plain data-testid stub can't exercise the "select a patient" step.
  PatientSearchDropdown: ({ onSelectPatient }: { onSelectPatient: (pid: number, row?: { display_name: string }) => void }) => (
    <button type="button" onClick={() => onSelectPatient(1, { display_name: 'Smith, Sam' })}>
      Pick Smith, Sam
    </button>
  ),
}));

function dayPayload(overrides: Partial<CalendarDayPayload> = {}): CalendarDayPayload {
  return {
    date: '2026-06-30',
    facility_id: 3,
    provider_id: null,
    interval_minutes: 15,
    events: [],
    categories: [
      { id: 1, label: 'General OPD' },
      { id: 5, label: 'Eye clinic' },
    ],
    providers: [{ id: 10, label: 'Smith, Jane' }],
    revision: 'cal-rev-1',
    poll_interval_ms: 30000,
    can_book: true,
    ...overrides,
  };
}

const filters = { facilityId: 3, providerId: 0, date: '2026-06-30' };

function renderSheet(payload: CalendarDayPayload, draft: CalendarBookingDraft | null = null) {
  return render(
    <CalendarBookingSheet
      open
      ajaxUrl="/mock/ajax"
      csrfToken="token"
      filters={filters}
      payload={payload}
      draft={draft}
      onClose={() => {}}
      onBooked={() => {}}
    />,
  );
}

describe('CalendarBookingSheet', () => {
  it('defaults the visit type to the server-resolved default, not the first list entry', async () => {
    renderSheet(dayPayload({ default_visit_type_id: 5 }));

    const select = await screen.findByLabelText<HTMLSelectElement>(/visit type/i);
    expect(select.value).toBe('5');
  });

  it('falls back to the first visit type when no default is provided', async () => {
    renderSheet(dayPayload());

    const select = await screen.findByLabelText<HTMLSelectElement>(/visit type/i);
    expect(select.value).toBe('1');
  });

  it('resolves a real default provider when the draft carries providerId: 0 ("All providers" sentinel)', async () => {
    // The "+ Book appointment" tab button (CalendarLens) passes providerId: 0
    // when the "All providers" filter is active — a deliberate "you decide"
    // sentinel, not a real id. The sheet must recompute it from the
    // available providers, not treat 0 as an already-chosen value.
    //
    // A native <select> with a controlled value that matches no <option>
    // still visually renders the first option as "selected" — reading
    // select.value here would pass even with the bug (0 stuck, never fixed)
    // because it reflects that display fallback, not the true React state.
    // Only the Save button's disabled-ness (driven by canSave, not the DOM)
    // proves providerId genuinely resolved to a real id.
    const draft: CalendarBookingDraft = {
      date: '2026-06-30',
      time: '09:00',
      providerId: 0,
      pid: 0,
      patientLabel: '',
      visitTypeId: 1,
      durationMinutes: 15,
      comments: '',
    };
    renderSheet(dayPayload(), draft);

    (await screen.findByText('Pick Smith, Sam')).click();

    expect(await screen.findByRole('button', { name: /save appointment/i })).toBeEnabled();
  });

  it('offers next free times and fills the Time field when a chip is tapped', async () => {
    renderSheet(dayPayload());

    const chip = await screen.findByRole('button', { name: '09:30' });
    chip.click();

    const timeInput = await screen.findByLabelText<HTMLInputElement>(/time/i);
    expect(timeInput.value).toBe('09:30');
  });

  it('books a recurring series with repeat + until date', async () => {
    renderSheet(dayPayload());
    (await screen.findByText('Pick Smith, Sam')).click();

    fireEvent.change(await screen.findByLabelText(/repeats/i), { target: { value: 'weekly' } });
    fireEvent.change(await screen.findByLabelText(/^until$/i), { target: { value: '2026-08-30' } });
    fireEvent.click(screen.getByRole('button', { name: /save appointment/i }));

    await waitFor(() => expect(bookCalendarAppointment).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ repeat: 'weekly', repeat_until: '2026-08-30' }),
    ));
  });

  it('shows the manual-pick note when no slots are free', async () => {
    fetchFreeSlotsMock.mockResolvedValueOnce({ slots: [], interval_minutes: 15 });
    renderSheet(dayPayload());

    expect(await screen.findByText(/no free slots/i)).toBeInTheDocument();
  });
});
