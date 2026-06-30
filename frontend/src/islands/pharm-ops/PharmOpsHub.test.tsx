import { render, screen, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { PharmOpsHub } from './PharmOpsHub';

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

vi.mock('./PharmOpsOtcSaleDrawer', () => ({
  PharmOpsOtcSaleDrawer: ({ open }: { open: boolean }) => (
    open ? <div data-testid="nc-pharmops-otc-drawer-mock">OTC drawer</div> : null
  ),
}));

vi.mock('./PharmOpsDestroyDrawer', () => ({
  PharmOpsDestroyDrawer: ({ open }: { open: boolean }) => (
    open ? <div data-testid="nc-pharmops-destroy-drawer-mock">Destroy drawer</div> : null
  ),
}));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  moduleUrl: '/module',
  pharmacyDeskUrl: '/pharmacy',
  visitBoardUrl: '/visit-board',
  facilityId: 1,
  initialTab: 'pending_dispense' as const,
  canDispense: true,
  canReceive: true,
  canDestroy: true,
  webroot: '/openemr',
};

describe('PharmOpsHub', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'pharm_ops.worklist') {
        return Promise.resolve({
          rows: [{
            prescription_id: 882,
            pid: 123,
            patient_label: 'Akua M.',
            mrn: '00123',
            queue_number: 7,
            drug_name: 'Amoxicillin 500 mg',
            qty_ordered: 21,
            qty_dispensed: 0,
            dispense_status: 'pending',
            status_label: 'Not dispensed',
            stock_status: 'in_stock',
            ordered_display: 'ordered 10:02',
          }],
          counts: { pending_dispense: 1, low_stock: 0 },
          last_updated: '2026-06-28T12:00:00+00:00',
        });
      }
      if (action === 'pharm_ops.reports_embed') {
        return Promise.resolve({
          default_report_id: 'reorder',
          reports: [{
            id: 'reorder',
            label: 'Reorder / low stock',
            description: 'Reorder list',
            embed_url: '/openemr/interface/reports/inventory_list.php',
          }],
        });
      }
      return Promise.resolve({});
    });

    document.body.innerHTML =
      '<button id="nc-pharmops-tab-pending" class="active"></button>' +
      '<button id="nc-pharmops-tab-lowstock"></button>' +
      '<button id="nc-pharmops-tab-writeoff"></button>' +
      '<button id="nc-pharmops-tab-reports"></button>' +
      '<span id="nc-pharmops-count-pending">0</span>' +
      '<span id="nc-pharmops-count-lowstock">0</span>' +
      '<span id="nc-pharmops-count-writeoff">0</span>' +
      '<input id="nc-pharmops-date" type="date" value="2026-06-28" />' +
      '<input id="nc-pharmops-urgent-first" type="checkbox" checked />' +
      '<div id="nc-pharmops-urgent-wrap"></div>' +
      '<button id="nc-pharmops-refresh"></button>' +
      '<button id="nc-pharmops-sell-otc">Sell OTC</button>' +
      '<span id="nc-pharmops-updated"></span>';
  });

  afterEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
  });

  it('loads worklist on mount', async () => {
    render(<PharmOpsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'pharm_ops.worklist',
      expect.objectContaining({
        json: expect.objectContaining({
          tab: 'pending_dispense',
          filters: { urgent_first: true },
        }),
      }),
    );
    expect(screen.getByText(/Akua M\./)).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin 500 mg')).toBeInTheDocument();
  });

  it('shows empty state when no rows', async () => {
    mockFetch.mockResolvedValueOnce({
      rows: [],
      counts: { pending_dispense: 0, low_stock: 0 },
    });

    render(<PharmOpsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Nothing to dispense/)).toBeInTheDocument();
  });

  it('loads low stock tab rows', async () => {
    mockFetch.mockResolvedValueOnce({
      rows: [{
        row_type: 'low_stock',
        drug_id: 44,
        drug_name: 'Paracetamol 500 mg',
        on_hand: 2,
        reorder_point: 20,
        stock_status: 'low',
        status_label: 'Low stock',
        qoh_display: 'QOH 2 · reorder 20',
      }],
      counts: { pending_dispense: 1, low_stock: 1 },
    });

    render(<PharmOpsHub {...props} initialTab="low_stock" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'pharm_ops.worklist',
      expect.objectContaining({
        json: expect.objectContaining({ tab: 'low_stock' }),
      }),
    );
    expect(screen.getByText('Paracetamol 500 mg')).toBeInTheDocument();
    expect(screen.getByText(/Low stock/)).toBeInTheDocument();
  });

  it('opens OTC drawer from toolbar', async () => {
    render(<PharmOpsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      document.getElementById('nc-pharmops-sell-otc')?.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('nc-pharmops-otc-drawer-mock')).toBeInTheDocument();
    });
  });

  it('loads write-off tab rows', async () => {
    mockFetch.mockResolvedValueOnce({
      rows: [{
        row_type: 'write_off',
        drug_id: 12,
        inventory_id: 99,
        drug_name: 'Expired Amoxicillin',
        lot_number: 'LOT-OLD',
        on_hand: 40,
        expiration: '2025-01-01',
        lot_status: 'expired',
        status_label: 'Expired',
        qoh_display: 'QOH 40 · exp 2025-01-01',
      }],
      counts: { pending_dispense: 0, low_stock: 0, write_off: 1 },
      expiry_warn_days: 90,
    });

    render(<PharmOpsHub {...props} initialTab="write_off" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'pharm_ops.worklist',
      expect.objectContaining({
        json: expect.objectContaining({ tab: 'write_off' }),
      }),
    );
    expect(screen.getByText('Expired Amoxicillin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write off lot' })).toBeInTheDocument();
  });

  it('opens destroy drawer from write-off row', async () => {
    mockFetch.mockResolvedValueOnce({
      rows: [{
        row_type: 'write_off',
        drug_id: 12,
        inventory_id: 99,
        drug_name: 'Expired Amoxicillin',
        lot_number: 'LOT-OLD',
        on_hand: 40,
        expiration: '2025-01-01',
        lot_status: 'expired',
        status_label: 'Expired',
      }],
      counts: { write_off: 1 },
    });

    render(<PharmOpsHub {...props} initialTab="write_off" />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Write off lot' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('nc-pharmops-destroy-drawer-mock')).toBeInTheDocument();
    });
  });

  it('loads reports tab embed catalog', async () => {
    render(<PharmOpsHub {...props} initialTab="reports" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith('pharm_ops.reports_embed', expect.any(Object));
    expect(screen.getByLabelText('Report')).toBeInTheDocument();
    expect(screen.queryByText(/Akua M\./)).not.toBeInTheDocument();
  });
});
