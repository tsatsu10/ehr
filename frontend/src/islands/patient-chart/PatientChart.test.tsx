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

  it('shows in-chart search when enabled', async () => {
    render(<PatientChart {...props} enableInChartPatientSearch />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByPlaceholderText(/Search this chart/i)).toBeInTheDocument();
  });

  it('hides the print/letters menu when enable_letters_labels is off', async () => {
    render(<PatientChart {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('button', { name: /Print or write letter/i })).not.toBeInTheDocument();
  });

  it('shows the print/letters menu with labels and the referral-letter link when enabled (GAP-A A4)', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(
      <PatientChart
        {...props}
        enableLabels
        labelPrintUrl="/patient-label.php"
        lettersHubUrl="/chart-depth/referrals.php?view=letters&pid=42"
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const trigger = screen.getByRole('button', { name: /Print or write letter/i });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    fireEvent.click(trigger);

    // The referral-letter entry is a real link into the letters hub.
    const letterLink = await screen.findByRole('menuitem', { name: 'Referral letter…' });
    expect(letterLink).toHaveAttribute('href', '/chart-depth/referrals.php?view=letters&pid=42');

    expect(screen.getByRole('menuitem', { name: 'Chart label (name, DOB, MRN)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Address label' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'MRN barcode label' }));
    expect(openSpy).toHaveBeenCalledWith(
      '/patient-label.php?pid=42&type=barcode&print=1',
      '_blank',
      'noopener,noreferrer'
    );
    openSpy.mockRestore();
  });
});
