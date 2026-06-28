import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PatientChart } from './PatientChart';

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

vi.mock('@islands/front-desk/RegistrationForm', () => ({
  RegistrationForm: () => <div data-testid="registration-form">Registration form</div>,
}));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const previewPayload = {
  identity: {
    pid: 42,
    pubpid: 'MRN-42',
    display_name: 'Jane Doe',
    sex: 'Female',
    age_years: '32',
  },
  completion: { score: 85, billing_threshold: 70, missing_labels: [] },
  safety: {},
  activity_feed: { items: [], has_more: false, lookback_days: 90 },
};

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  pid: 42,
  activeTab: 'overview' as const,
  visitBoardUrl: '/visit-board',
  frontDeskUrl: '/front-desk',
  registrationMode: 'desk_full_form',
};

describe('PatientChart', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'patients.preview') return Promise.resolve(previewPayload);
      if (action === 'patients.registration.get') {
        return Promise.resolve({ completion_by_level: [], completion: previewPayload.completion });
      }
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads banner and overview tab', async () => {
    render(<PatientChart {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'patients.preview',
      expect.objectContaining({ json: expect.objectContaining({ pid: 42, context: 'patient-chart' }) })
    );
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('No active visit today.')).toBeInTheDocument();
  });

  it('switches to profile tab', async () => {
    render(<PatientChart {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Profile/i }));
    });

    expect(await screen.findByTestId('registration-form')).toBeInTheDocument();
  });
});
