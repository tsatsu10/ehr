import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { LabDesk } from './LabDesk';
import type { LabQueueData, LabSelectData } from '@core/types';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
  OeFetchError: class OeFetchError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const emptyQueue: LabQueueData = {
  visits: [],
  counts: { waiting: 0, in_lab: 0, total: 0 },
  has_active_work: false,
  visit_date: '2026-06-27',
};

const waitingVisit = {
  id: 11,
  queue_number: '6',
  display_name: 'Kofi Asante',
  pid: 5,
  pubpid: 'MRN005',
  state: 'ready_for_lab' as const,
  sex: 'M',
  age_years: '34',
  wait_minutes: 8,
  wait_label: '8m',
  visit_date: '2026-06-27',
  visit_type_label: 'General OPD',
  is_urgent: 0 as const,
  order_count: 2,
  row_version: 1,
};

const selectData: LabSelectData = {
  visit: {
    id: 11,
    pid: 5,
    encounter: 60,
    queue_number: '6',
    state: 'in_lab',
    visit_type_label: 'General OPD',
    row_version: 2,
  },
  preview: {
    identity: { pid: 5, pubpid: 'MRN005', display_name: 'Kofi Asante', sex: 'M', age_years: '34' },
    completion: { score: 85, billing_threshold: 70 },
  },
  lab_orders: [
    { id: 101, title: 'Full blood count', code: 'FBC', status: 'pending' },
  ],
  can_skip_to_payment: false,
};

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  facilityId: 1,
  visitBoardUrl: '/visit-board',
};

describe('LabDesk', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(emptyQueue);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows idle placeholder while loading queue', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<LabDesk {...props} />);
    expect(screen.getByText(/Choose a patient from the lab queue/i)).toBeInTheDocument();
  });

  it('renders queue visits after poll', async () => {
    mockFetch.mockResolvedValue({
      ...emptyQueue,
      visits: [waitingVisit],
      counts: { waiting: 1, in_lab: 0, total: 1 },
    });

    render(<LabDesk {...props} />);

    await waitFor(() => {
      expect(screen.getByText(/Kofi Asante/)).toBeInTheDocument();
    });
    await waitFor(() => {
      const bar = screen.getByLabelText(/Lab desk status/i);
      expect(bar).toHaveTextContent('1');
      expect(bar).toHaveTextContent('Waiting');
    });
  });

  it('auto-takes and shows lab orders when ready visit selected', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingVisit],
        counts: { waiting: 1, in_lab: 0, total: 1 },
      })
      .mockResolvedValueOnce({
        visit: { ...selectData.visit, state: 'ready_for_lab' as const, row_version: 1 },
        preview: selectData.preview,
        lab_orders: [],
      })
      .mockResolvedValueOnce(selectData)
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [{ ...waitingVisit, state: 'in_lab' as const }],
        counts: { waiting: 0, in_lab: 1, total: 1 },
        has_active_work: true,
      });

    render(<LabDesk {...props} />);

    await waitFor(() => screen.getByText(/Kofi Asante/));
    fireEvent.click(screen.getByText(/Kofi Asante/));

    await waitFor(() => {
      expect(screen.getByText(/Lab orders/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Lab complete/i })).toBeInTheDocument();
  });
});
