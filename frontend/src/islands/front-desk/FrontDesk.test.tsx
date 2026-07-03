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
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width') ? false : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    mockFetch.mockImplementation(async (action: string) => {
      if (action === 'front_desk.desk_stats') {
        return { visits_started_today: 0, waiting_count: 0, recent_starts: [] };
      }
      if (action === 'front_desk.recently_viewed') {
        return { recent: [] };
      }
      if (action === 'front_desk.todays_appointments') {
        return { appointments: [] };
      }
      return {};
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('uses single-column layout when no patient is selected', () => {
    const { container } = render(<FrontDesk {...props} />);
    const root = container.querySelector('.oe-nc-front-desk-react-active');
    expect(root).toHaveClass('oe-nc-front-desk--idle');
    expect(container.querySelector('.oe-nc-front-desk-grid__preview')).toBeNull();
  });

  it('renders the desk status bar', () => {
    render(<FrontDesk {...props} />);
    expect(screen.getByLabelText(/Front desk status/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting now/i)).toBeInTheDocument();
    expect(screen.getByText(/Visits started today/i)).toBeInTheDocument();
  });

  it('loads preview after search and select', async () => {
    mockFetch.mockImplementation(async (action: string) => {
      if (action === 'front_desk.desk_stats') {
        return { visits_started_today: 0, waiting_count: 0, recent_starts: [] };
      }
      if (action === 'front_desk.recently_viewed') {
        return { recent: [] };
      }
      if (action === 'patients.search') {
        return { patients: [searchRow] };
      }
      if (action === 'patients.preview') {
        return previewData;
      }
      if (action === 'visit.types') {
        return { visit_types: [{ id: 1, label: 'General OPD', is_default: true }] };
      }
      if (action === 'front_desk.recently_viewed.remember') {
        return { recent: [{ pid: 42, display_name: 'Kwame Boateng', pubpid: 'MRN042' }] };
      }
      return {};
    });

    render(<FrontDesk {...props} />);

    const input = screen.getByPlaceholderText(/Search patient/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Kwame' } });
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(await screen.findByRole('button', { name: /Start visit/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Kwame Boateng/i })).toBeInTheDocument();
  });

  it('surfaces scheduling info on the status bar when enabled', () => {
    render(
      <FrontDesk
        {...props}
        scheduledIntegrationEnabled
        appointmentsTodayCount={3}
        calendarUrl="/calendar"
      />
    );
    const bar = screen.getByLabelText(/Front desk status/i);
    expect(bar).toHaveTextContent(/Scheduled today/i);
    expect(bar).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
  });

  it('shows today appointments in search idle state when scheduling enabled', async () => {
    mockFetch.mockImplementation(async (action: string) => {
      if (action === 'front_desk.desk_stats') {
        return { visits_started_today: 0, waiting_count: 0, recent_starts: [] };
      }
      if (action === 'front_desk.recently_viewed') {
        return { recent: [] };
      }
      if (action === 'front_desk.todays_appointments') {
        return {
          appointments: [
            {
              pid: 99,
              display_name: 'Ama Serwaa',
              pubpid: 'MRN099',
              pc_eid: 12,
              start_time_label: '9:00 AM',
              provider_name: 'Dr. Mensah',
            },
          ],
        };
      }
      return {};
    });

    render(
      <FrontDesk
        {...props}
        scheduledIntegrationEnabled
        appointmentsTodayCount={1}
      />
    );

    expect(await screen.findByText(/Today's appointments/i)).toBeInTheDocument();
    expect(screen.getByText('Ama Serwaa')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
  });
});
