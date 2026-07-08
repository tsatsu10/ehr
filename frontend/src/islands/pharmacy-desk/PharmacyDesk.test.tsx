import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { PharmacyDesk } from './PharmacyDesk';
import type { PharmacyQueueData, PharmacySelectData } from '@core/types';

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

const emptyQueue: PharmacyQueueData = {
  visits: [],
  counts: { waiting: 0, in_pharmacy: 0, total: 0 },
  has_active_work: false,
  visit_date: '2026-06-27',
};

const waitingVisit = {
  id: 21,
  queue_number: '8',
  display_name: 'Ama Mensah',
  pid: 7,
  pubpid: 'MRN007',
  state: 'ready_for_pharmacy' as const,
  sex: 'F',
  age_years: '28',
  wait_minutes: 5,
  wait_label: '5m',
  visit_date: '2026-06-27',
  visit_type_label: 'General OPD',
  is_urgent: 0 as const,
  rx_count: 3,
  row_version: 1,
};

const selectData: PharmacySelectData = {
  visit: {
    id: 21,
    pid: 7,
    encounter: 70,
    queue_number: '8',
    state: 'in_pharmacy',
    visit_type_label: 'General OPD',
    row_version: 2,
  },
  preview: {
    identity: { pid: 7, pubpid: 'MRN007', display_name: 'Ama Mensah', sex: 'F', age_years: '28' },
    completion: { score: 90, billing_threshold: 70 },
  },
  prescriptions: [
    { id: 201, drug: 'Paracetamol 500mg', sig: '1 tab q8h', quantity: '30', status: 'to_dispense' },
  ],
  rx_list_url: '/controller.php?prescription&list&id=7',
};

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  facilityId: 1,
  visitBoardUrl: '/visit-board',
};

describe('PharmacyDesk', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(emptyQueue);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows idle placeholder while loading queue', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<PharmacyDesk {...props} />);
    expect(screen.getByText(/Choose a patient from the pharmacy queue/i)).toBeInTheDocument();
  });

  it('renders queue visits after poll', async () => {
    mockFetch.mockResolvedValue({
      ...emptyQueue,
      visits: [waitingVisit],
      counts: { waiting: 1, in_pharmacy: 0, total: 1 },
    });

    render(<PharmacyDesk {...props} />);

    await waitFor(() => {
      expect(screen.getByText(/Ama Mensah/)).toBeInTheDocument();
    });
    await waitFor(() => {
      const bar = screen.getByLabelText(/Pharmacy desk status/i);
      expect(bar).toHaveTextContent('1');
      expect(bar).toHaveTextContent('Waiting');
    });
  });

  it('auto-takes and shows prescriptions when ready visit selected', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingVisit],
        counts: { waiting: 1, in_pharmacy: 0, total: 1 },
      })
      .mockResolvedValueOnce({
        visit: { ...selectData.visit, state: 'ready_for_pharmacy' as const, row_version: 1 },
        preview: selectData.preview,
        prescriptions: [],
      })
      .mockResolvedValueOnce(selectData)
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [{ ...waitingVisit, state: 'in_pharmacy' as const }],
        counts: { waiting: 0, in_pharmacy: 1, total: 1 },
        has_active_work: true,
      });

    render(<PharmacyDesk {...props} />);

    await waitFor(() => screen.getByText(/Ama Mensah/));
    fireEvent.click(screen.getByText(/Ama Mensah/));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Prescriptions$/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Pharmacy complete/i })).toBeInTheDocument();
    expect(screen.getByText(/Paracetamol 500mg/)).toBeInTheDocument();
  });

  it('shows skip to payment when permitted and submits skip action', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [{ ...waitingVisit, state: 'in_pharmacy' as const }],
        counts: { waiting: 0, in_pharmacy: 1, total: 1 },
        has_active_work: true,
      })
      .mockResolvedValueOnce({
        ...selectData,
        can_skip_to_payment: true,
      })
      .mockResolvedValueOnce(emptyQueue)
      .mockResolvedValueOnce(emptyQueue);

    render(<PharmacyDesk {...props} canSkipToPayment />);

    await waitFor(() => screen.getByText(/Ama Mensah/));
    fireEvent.click(screen.getByText(/Ama Mensah/));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Skip to payment/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Skip to payment/i }));
    fireEvent.change(screen.getByLabelText(/Reason/i), {
      target: { value: 'Patient declined all prescriptions' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Skip to payment$/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'pharmacy.skip_to_payment',
        expect.objectContaining({
          method: 'POST',
          json: expect.objectContaining({
            visit_id: 21,
            reason: 'Patient declined all prescriptions',
          }),
        }),
      );
    });
  });
});
