import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import { FrontDesk } from './FrontDesk';
import type { FrontDeskPreviewData, PatientSearchRow } from '@core/types';

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

const searchRow: PatientSearchRow = {
  pid: 42,
  display_name: 'Kwame Boateng',
  pubpid: 'MRN042',
  sex: 'M',
  age_years: '45',
  phone_masked: '024***1122',
  completion_score: 82,
};

const previewData: FrontDeskPreviewData = {
  identity: {
    pid: 42,
    display_name: 'Kwame Boateng',
    pubpid: 'MRN042',
    sex: 'M',
    age_years: '45',
    phone_masked: '024***1122',
  },
  completion: { score: 82, billing_threshold: 70, missing_labels: [] },
  safety: { allergies_severe: [] },
  active_visit: null,
};

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  facilityId: 1,
  moduleUrl: '/module',
};

describe('FrontDesk', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({ patients: [] });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows empty preview on load', () => {
    render(<FrontDesk {...props} />);
    expect(screen.getByText(/No patient selected/i)).toBeInTheDocument();
  });

  it('loads preview after search and select', async () => {
    mockFetch
      .mockResolvedValueOnce({ patients: [searchRow] })
      .mockResolvedValueOnce(previewData)
      .mockResolvedValueOnce({ visit_types: [{ id: 1, label: 'General OPD', is_default: true }] });

    render(<FrontDesk {...props} />);

    const input = screen.getByPlaceholderText(/Search by name/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Kwame' } });
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(await screen.findByRole('button', { name: /Start visit/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Kwame Boateng/i })).toBeInTheDocument();
  });

  it('shows scheduling banner when enabled', () => {
    render(
      <FrontDesk
        {...props}
        scheduledIntegrationEnabled
        appointmentsTodayCount={3}
        calendarUrl="/calendar"
      />
    );
    expect(screen.getByText(/Scheduling linked/i)).toBeInTheDocument();
    expect(screen.getByText(/3 appointment/i)).toBeInTheDocument();
  });
});
