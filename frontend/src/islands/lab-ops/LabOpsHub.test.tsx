import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { LabOpsHub } from './LabOpsHub';

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

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  moduleUrl: '/module',
  labDeskUrl: '/lab',
  visitBoardUrl: '/visit-board',
  facilityId: 1,
  initialTab: 'pending' as const,
  canEnter: true,
  canRelease: true,
  canManageCatalog: false,
  canShowAdvanced: false,
  webroot: '/openemr',
};

describe('LabOpsHub', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'lab_ops.worklist') {
        return Promise.resolve({
          rows: [{
            procedure_order_id: 42,
            patient_name: 'Jane Doe',
            pubpid: 'MRN001',
            test_names: 'CBC',
            fulfillment: 'in_house',
            fulfillment_label: 'In-house',
            status_label: 'Pending collection',
            collected: false,
          }],
          counts: { pending: 1, in_progress: 0, send_out: 0 },
          last_updated: '2026-06-28T12:00:00+00:00',
        });
      }
      return Promise.resolve({});
    });

    document.body.innerHTML =
      '<button id="nc-labops-tab-pending" class="active"></button>' +
      '<button id="nc-labops-tab-progress"></button>' +
      '<button id="nc-labops-tab-sendout"></button>' +
      '<span id="nc-labops-count-pending">0</span>' +
      '<span id="nc-labops-count-progress">0</span>' +
      '<span id="nc-labops-count-sendout">0</span>' +
      '<input id="nc-labops-date" type="date" value="2026-06-28" />' +
      '<select id="nc-labops-fulfillment"><option value="all">All</option></select>' +
      '<input id="nc-labops-urgent-first" type="checkbox" checked />' +
      '<button id="nc-labops-refresh"></button>' +
      '<span id="nc-labops-updated"></span>';
  });

  afterEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
  });

  it('loads worklist on mount', async () => {
    render(<LabOpsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'lab_ops.worklist',
      expect.objectContaining({
        json: expect.objectContaining({ tab: 'pending', facility_id: 1 }),
      })
    );
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  });

  it('switches worklist tab via page heading button', async () => {
    render(<LabOpsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(document.getElementById('nc-labops-tab-progress')!);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'lab_ops.worklist',
      expect.objectContaining({
        json: expect.objectContaining({ tab: 'in_progress' }),
      })
    );
  });
});
