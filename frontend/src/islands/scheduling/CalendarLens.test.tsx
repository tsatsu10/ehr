import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { CalendarLens } from './CalendarLens';

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

const filters = { facilityId: 3, providerId: 0, date: '2026-06-30' };

describe('CalendarLens', () => {
  it('renders agenda with appointment row', async () => {
    render(
      <CalendarLens
        ajaxUrl="/mock/ajax"
        csrfToken="token"
        filters={filters}
        refreshToken={0}
        bookSignal={0}
        frontDeskUrl="/front-desk"
      />,
    );

    expect(await screen.findByText(/Ama Boateng/)).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /09:00/ })).toBeInTheDocument();
    expect(screen.getByText(/1 appointment on 2026-06-30/i)).toBeInTheDocument();
  });
});
