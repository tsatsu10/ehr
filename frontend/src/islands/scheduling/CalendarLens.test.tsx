import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';
import { CalendarLens } from './CalendarLens';
import { fetchCalendarRange } from './schedulingApi';

vi.mock('./schedulingApi', () => ({
  fetchCalendarRange: vi.fn().mockResolvedValue({
    date: '2026-06-30',
    start_date: '2026-06-30',
    end_date: '2026-06-30',
    view: 'day',
    anchor_date: '2026-06-30',
    facility_id: 3,
    provider_id: null,
    interval_minutes: 15,
    poll_interval_ms: 30000,
    revision: 'cal-rev-1',
    can_book: true,
    categories: [{ id: 5, label: 'Office Visit' }],
    providers: [{ id: 10, label: 'Smith, Jane' }],
    events: [{
      pc_eid: 99,
      pid: 3,
      pubpid: 'MRN003',
      patient_name: 'Ama Boateng',
      event_date: '2026-06-30',
      start_time: '09:00',
      end_time: '09:15',
      duration_minutes: 15,
      provider_id: 10,
      provider_label: 'Smith, Jane',
      category_id: 5,
      category_label: 'Office Visit',
      status: '-',
      status_label: 'None',
      is_recurring: false,
      comments: '',
    }],
  }),
  moveCalendarAppointment: vi.fn(),
  resizeCalendarAppointment: vi.fn(),
  pollCalendarRange: vi.fn(),
}));

vi.mock('./CalendarBookingSheet', () => ({
  CalendarBookingSheet: () => null,
}));

function renderLens() {
  return render(
    <CalendarLens
      ajaxUrl="/mock/ajax"
      csrfToken="token"
      filters={filters}
      refreshToken={0}
      bookSignal={0}
      frontDeskUrl="/front-desk"
    />,
  );
}

const filters = { facilityId: 3, providerId: 0, date: '2026-06-30' };

describe('CalendarLens', () => {
  it('shows a loading skeleton on first paint, before any data arrives', () => {
    // Never-resolving fetch = the real first-paint state (loading, no data yet).
    vi.mocked(fetchCalendarRange).mockReturnValueOnce(new Promise(() => {}));
    const { container } = renderLens();

    expect(container.querySelector('.nc-calendar-skeleton')).toBeTruthy();
    expect(container.querySelectorAll('.nc-calendar-skeleton-row').length).toBeGreaterThan(0);
    // Announced for screen readers even though the bars are aria-hidden.
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    // The view switcher must stay mounted while loading — skeletonising it too
    // made the tabs pop in after the fetch and jump the layout.
    expect(screen.getByRole('tab', { name: /Agenda/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Week/i })).toBeInTheDocument();
  });

  it('renders agenda with appointment row', async () => {
    renderLens();

    expect(await screen.findByText(/Ama Boateng/)).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /09:00/ })).toBeInTheDocument();
    expect(screen.getByText(/1 appointment on 30\/06\/2026/i)).toBeInTheDocument();
  });

  it('opens a details dialog when an appointment is selected and closes it', async () => {
    renderLens();

    fireEvent.click(await screen.findByRole('listitem', { name: /Ama Boateng/ }));

    const peek = await screen.findByRole('dialog', { name: /Ama Boateng appointment/i });
    expect(peek).toBeInTheDocument();
    expect(peek).toHaveTextContent('MRN003');
    expect(peek).toHaveTextContent('Office Visit');

    fireEvent.click(within(peek).getAllByRole('button', { name: /close/i })[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
