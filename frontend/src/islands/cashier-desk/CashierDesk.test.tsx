import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { CashierDesk } from './CashierDesk';
import type { CashierQueueData, CashierResolveData, CashierSelectData } from '@core/types';

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

const emptyQueue: CashierQueueData = {
  visits: [],
  counts: { waiting: 0, paid_today: 0, closed_unpaid: 0 },
  visit_date: '2026-06-27',
};

const waitingVisit = {
  id: 9,
  queue_number: '4',
  display_name: 'Ama Boateng',
  pid: 3,
  pubpid: 'MRN003',
  state: 'ready_for_payment' as const,
  sex: 'F',
  age_years: '28',
  wait_minutes: 5,
  wait_label: '5m',
  visit_date: '2026-06-27',
  visit_type_label: 'General OPD',
  is_urgent: 0 as const,
  charges_total: 45,
};

const selectData: CashierSelectData = {
  visit: {
    id: 9,
    pid: 3,
    encounter: 50,
    queue_number: '4',
    state: 'ready_for_payment',
    row_version: 1,
  },
  preview: {
    identity: { pid: 3, pubpid: 'MRN003', display_name: 'Ama Boateng', sex: 'F', age_years: '28' },
    completion: { score: 90, billing_threshold: 70 },
  },
  charges: [],
  charges_total: 45,
  fee_schedule: [{ id: 1, code: 'CONS', name: 'Consultation', price_amount: 45 }],
  suggested_fees: [{ id: 1, code: 'CONS', name: 'Consultation', price_amount: 45 }],
  completion_blocked: false,
  can_skip_completion: false,
  can_close_without_charge: false,
  encounter_signed: true,
  can_apply_discount: true,
};

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  facilityId: 1,
  visitBoardUrl: '/visit-board',
  canApplyDiscount: true,
};

describe('CashierDesk', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(emptyQueue);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows idle placeholder while loading queue', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<CashierDesk {...props} />);
    expect(screen.getByText(/Choose a patient from the payment queue/i)).toBeInTheDocument();
  });

  it('renders queue visits after poll', async () => {
    mockFetch.mockResolvedValue({
      ...emptyQueue,
      visits: [waitingVisit],
      counts: { waiting: 1, paid_today: 0, closed_unpaid: 0 },
    });

    render(<CashierDesk {...props} />);

    await waitFor(() => {
      expect(screen.getByText(/Ama Boateng/)).toBeInTheDocument();
    });
    await waitFor(() => {
      const bar = screen.getByLabelText(/Cashier desk status/i);
      expect(bar).toHaveTextContent('1');
      expect(bar).toHaveTextContent('Waiting for payment');
    });
  });

  it('loads checkout pane when queue card clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingVisit],
        counts: { waiting: 1, paid_today: 0, closed_unpaid: 0 },
      })
      .mockResolvedValueOnce(selectData);

    render(<CashierDesk {...props} />);

    await waitFor(() => screen.getByText(/Ama Boateng/));
    fireEvent.click(screen.getByText(/Ama Boateng/));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Posted charges$/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Take payment/i })).toBeInTheDocument();
  });

  it('shows a Medicines section with dispensed drug charges when present (CBILL-1)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingVisit],
        counts: { waiting: 1, paid_today: 0, closed_unpaid: 0 },
      })
      .mockResolvedValueOnce({
        ...selectData,
        drug_charges: [
          { sale_id: 11, drug_id: 4, description: 'Paracetamol 500mg', quantity: 20, amount: 12 },
        ],
        charges_total: 57,
      });

    render(<CashierDesk {...props} />);

    await waitFor(() => screen.getByText(/Ama Boateng/));
    fireEvent.click(screen.getByText(/Ama Boateng/));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Medicines$/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/Paracetamol 500mg/)).toBeInTheDocument();
    expect(screen.getByText(/Medicines subtotal/i)).toBeInTheDocument();
  });

  it('shows no Medicines section when drug_charges is absent (flag off)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingVisit],
        counts: { waiting: 1, paid_today: 0, closed_unpaid: 0 },
      })
      .mockResolvedValueOnce(selectData);

    render(<CashierDesk {...props} />);

    await waitFor(() => screen.getByText(/Ama Boateng/));
    fireEvent.click(screen.getByText(/Ama Boateng/));

    await waitFor(() => screen.getByRole('heading', { name: /^Posted charges$/i }));
    expect(screen.queryByRole('heading', { name: /^Medicines$/i })).not.toBeInTheDocument();
  });

  it('opens pay confirm modal when Take payment is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingVisit],
        counts: { waiting: 1, paid_today: 0, closed_unpaid: 0 },
      })
      .mockResolvedValueOnce(selectData);

    render(<CashierDesk {...props} />);

    await waitFor(() => screen.getByText(/Ama Boateng/));
    fireEvent.click(screen.getByText(/Ama Boateng/));

    await waitFor(() => screen.getByRole('button', { name: /Take payment/i }));
    fireEvent.click(screen.getByRole('button', { name: /Take payment/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Confirm payment/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/Confirm patient identity before posting payment/i)).toBeInTheDocument();
  });

  it('offers partial payment when enabled and permitted (CBILL-2)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingVisit],
        counts: { waiting: 1, paid_today: 0, closed_unpaid: 0 },
      })
      .mockResolvedValueOnce(selectData);

    render(<CashierDesk {...props} enablePartialPayment canPartialPay />);

    await waitFor(() => screen.getByText(/Ama Boateng/));
    fireEvent.click(screen.getByText(/Ama Boateng/));

    await waitFor(() => screen.getByRole('button', { name: /^Partial payment$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Partial payment$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Amount received/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Reason \(required\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Take partial payment/i })).toBeInTheDocument();
  });

  it('hides partial payment when the flag is off', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingVisit],
        counts: { waiting: 1, paid_today: 0, closed_unpaid: 0 },
      })
      .mockResolvedValueOnce(selectData);

    render(<CashierDesk {...props} />);

    await waitFor(() => screen.getByText(/Ama Boateng/));
    fireEvent.click(screen.getByText(/Ama Boateng/));

    await waitFor(() => screen.getByRole('button', { name: /Take payment/i }));
    expect(screen.queryByRole('button', { name: /Partial payment/i })).not.toBeInTheDocument();
  });

  it('opens esign override modal when Pay with E-Sign override is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingVisit],
        counts: { waiting: 1, paid_today: 0, closed_unpaid: 0 },
      })
      .mockResolvedValueOnce({
        ...selectData,
        encounter_signed: false,
        can_esign_override: true,
      });

    render(<CashierDesk {...props} canEsignOverride />);

    await waitFor(() => screen.getByText(/Ama Boateng/));
    fireEvent.click(screen.getByText(/Ama Boateng/));

    await waitFor(() => screen.getByRole('button', { name: /Pay with E-Sign override/i }));
    fireEvent.click(screen.getByRole('button', { name: /Pay with E-Sign override/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /E-Sign override/i })).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Reason/i)).toBeInTheDocument();
  });

  it('resolves patient search to checkout when single visit ready', async () => {
    const resolveData: CashierResolveData = {
      preview: selectData.preview,
      ready_for_payment: [{
        id: 9,
        queue_number: '4',
        display_name: 'Ama Boateng',
        charges_total: 45,
      }],
      resolution: 'single',
      message: '',
    };

    mockFetch
      .mockResolvedValueOnce(emptyQueue)
      .mockResolvedValueOnce({ patients: [{ pid: 3, display_name: 'Ama Boateng', pubpid: 'MRN003' }] })
      .mockResolvedValueOnce(resolveData)
      .mockResolvedValueOnce(selectData);

    render(<CashierDesk {...props} />);

    await waitFor(() => screen.getByLabelText(/Find patient/i));

    const search = screen.getByLabelText(/Find patient/i);
    fireEvent.change(search, { target: { value: 'Ama' } });

    await waitFor(() => screen.getByText(/MRN003/));
    fireEvent.mouseDown(screen.getByText(/MRN003/));
    fireEvent.click(screen.getByText(/Ama Boateng/));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Take payment/i })).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'cashier.resolve_patient',
      expect.objectContaining({ json: { pid: 3 } }),
    );
  });
});
