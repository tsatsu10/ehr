import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SchedulingShell } from './SchedulingShell';
import type { SchedulingProps } from './schedulingTypes';

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
    events: [],
  }),
  fetchCalendarDay: vi.fn(),
  pollCalendarRange: vi.fn(),
  fetchFlowBoard: vi.fn().mockResolvedValue({
    date: '2026-06-30',
    facility_id: 3,
    provider_id: null,
    poll_interval_ms: 20000,
    revision: 'test-revision',
    can_advance: true,
    queue_bridge_enabled: false,
    lanes: [],
  }),
  fetchRecallsWorklist: vi.fn().mockResolvedValue({
    bucket: 'due',
    facility_id: 3,
    provider_id: null,
    today: '2026-06-30',
    counts: { overdue: 0, due: 0, upcoming: 0, completed: 0 },
    can_manage: true,
    providers: [{ id: 10, label: 'Smith, Jane' }],
    rows: [],
  }),
  advanceFlowBoardStatus: vi.fn(),
  updateFlowBoardRoom: vi.fn(),
  pollFlowBoard: vi.fn(),
  fetchFlowBoardPrefs: vi.fn().mockResolvedValue({ collapsed: [], order: [] }),
  saveFlowBoardPrefs: vi.fn().mockResolvedValue({ collapsed: [], order: [] }),
  moveCalendarAppointment: vi.fn(),
  resizeCalendarAppointment: vi.fn(),
  bookCalendarAppointment: vi.fn(),
  fetchFreeSlots: vi.fn().mockResolvedValue({ slots: [], interval_minutes: 15 }),
}));

const props: SchedulingProps = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'token',
  moduleUrl: '/module',
  frontDeskUrl: '/front-desk',
  visitBoardUrl: '/visit-board',
  queueBridgeUrl: '/queue-bridge',
  facilityId: 3,
  initialLens: 'calendar',
  initialDate: '2026-06-30',
  initialProviderId: 0,
  canBook: true,
  facilities: [{ id: 3, label: 'Main Clinic' }],
  providers: [{ id: 10, label: 'Smith, Jane' }],
  webroot: '/openemr',
  authUserId: 1,
};

describe('SchedulingShell', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/scheduling/index.php');
  });

  it('renders shared filter bar and calendar lens', async () => {
    render(<SchedulingShell {...props} />);
    // Facility picker is gone — scheduling runs against the resolved facility.
    expect(screen.queryByLabelText(/Facility/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Provider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date/i)).toHaveValue('2026-06-30');
    expect(screen.getByRole('tab', { name: /Calendar/i })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText(/0 appointments on 30\/06\/2026/i)).toBeInTheDocument();
  });

  it('syncs lens changes to URL query params', async () => {
    render(<SchedulingShell {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: /Flow Board/i }));

    await waitFor(() => {
      expect(window.location.search).toContain('lens=flow');
    });
  });

  it('steps the date forward with the › button', async () => {
    render(<SchedulingShell {...props} />);
    await screen.findByText(/0 appointments/i);

    fireEvent.click(screen.getByRole('button', { name: /next day/i }));

    expect(screen.getByLabelText(/Date/i)).toHaveValue('2026-07-01');
  });

  it('steps the date with the ArrowRight keyboard shortcut', async () => {
    render(<SchedulingShell {...props} />);
    await screen.findByText(/0 appointments/i);

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByLabelText(/Date/i)).toHaveValue('2026-07-01');
    });
  });

  it('switches the calendar view with the w shortcut', async () => {
    render(<SchedulingShell {...props} />);
    await screen.findByText(/0 appointments/i);

    fireEvent.keyDown(window, { key: 'w' });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Week/i })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('ignores shortcuts while typing in an input', async () => {
    render(<SchedulingShell {...props} />);
    await screen.findByText(/0 appointments/i);

    const dateInput = screen.getByLabelText(/Date/i);
    fireEvent.keyDown(dateInput, { key: 'ArrowRight' });

    expect(dateInput).toHaveValue('2026-06-30');
  });
});
