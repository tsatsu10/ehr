import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PatientRegistry } from './PatientRegistry';

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

const presetsPayload = {
  builtins: [{ id: 'incomplete', label: 'Incomplete profiles', filters: { completion_max: 70 } }],
  saved: [],
  can_share_filter: false,
  visit_states: ['waiting', 'completed'],
  visit_types: [{ id: 1, label: 'General OPD' }],
  confirmation_sources: [{ value: 'problem_active', label: 'Problem list — active' }],
  condition_map: [{ key: 'malaria', label: 'Malaria' }],
};

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  chartUrlBase: '/mock/chart',
};

describe('PatientRegistry', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(presetsPayload);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows idle state before search', async () => {
    render(<PatientRegistry {...props} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/Apply filters to search the registry/i)).toBeInTheDocument();
    expect(screen.getByText(/No search yet — set criteria above and click Apply/i)).toBeInTheDocument();
  });

  it('runs search when Apply is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce(presetsPayload)
      .mockResolvedValueOnce({
        rows: [
          {
            pid: 1,
            name: 'Jane Doe',
            age_today: 32,
            sex: 'Female',
            mrn: 'MRN001',
            completion_pct: 85,
          },
        ],
        total: 1,
        page: 1,
        page_size: 25,
        meta: { query_ms: 12 },
      });

    render(<PatientRegistry {...props} />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'cohort.search',
      expect.objectContaining({
        json: expect.objectContaining({ page: 1, page_size: 25, sort: 'name_asc' }),
      })
    );
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/1 patient\(s\) match/i)).toBeInTheDocument();
  });

  it('shows sort and page size controls', async () => {
    render(<PatientRegistry {...props} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByLabelText(/Sort by/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rows per page/i)).toBeInTheDocument();
  });

  it('clears filters and resets table', async () => {
    render(<PatientRegistry {...props} />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    });

    expect(screen.getByText(/No search yet — set criteria above and click Apply/i)).toBeInTheDocument();
  });
});
