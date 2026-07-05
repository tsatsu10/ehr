import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import { FrontDesk } from './FrontDesk';
import type { FrontDeskPreviewData, PatientSearchRow } from '@core/types';

vi.mock('@core/useDeskViewport', () => ({
  useDeskViewport: vi.fn(() => 'desktop' as const),
}));

import { useDeskViewport } from '@core/useDeskViewport';
const mockUseDeskViewport = useDeskViewport as ReturnType<typeof vi.fn>;

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

const searchRow2: PatientSearchRow = {
  pid: 99,
  display_name: 'Ama Serwaa',
  pubpid: 'MRN099',
  sex: 'F',
  age_years: '30',
  phone_masked: '020***7788',
  completion_score: 90,
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
    window.localStorage.clear();
    mockUseDeskViewport.mockReturnValue('desktop');
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

  it('uses split layout with empty preview when no patient is selected', () => {
    const { container } = render(<FrontDesk {...props} />);
    const root = container.querySelector('.nc-front-desk-react-active');
    expect(root).toHaveClass('nc-front-desk-idle');
    expect(root).toHaveClass('nc-front-desk-split');
    expect(container.querySelector('.nc-front-desk-grid-preview')).toBeInTheDocument();
    expect(screen.getByText(/No patient selected/i)).toBeInTheDocument();
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
    expect(screen.getByRole('progressbar', { name: /Profile 82% complete/i })).toBeInTheDocument();
    expect(screen.getByText(/Profile completion/i)).toBeInTheDocument();
  });

  it('shows chief complaint on banner when active visit has CC', async () => {
    mockFetch.mockImplementation(async (action: string) => {
      if (action === 'front_desk.desk_stats') {
        return { visits_started_today: 1, waiting_count: 1, recent_starts: [] };
      }
      if (action === 'front_desk.recently_viewed') {
        return { recent: [] };
      }
      if (action === 'patients.search') {
        return { patients: [searchRow] };
      }
      if (action === 'patients.preview') {
        return {
          ...previewData,
          active_visit: {
            visit_id: 501,
            state: 'waiting',
            queue_number: 7,
            chief_complaint: 'Chest pain',
            row_version: 1,
          },
        };
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

    expect(await screen.findByText(/Chest pain/i)).toBeInTheDocument();
    expect(screen.getByText(/Reason for visit:/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Start visit$/i })).not.toBeInTheDocument();
  });

  it('shows live chief complaint draft on banner while typing', async () => {
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

    const ccField = await screen.findByLabelText(/Reason for visit/i);
    fireEvent.change(ccField, { target: { value: 'Sore throat' } });

    const draftBanner = document.getElementById('nc-banner-chief-complaint-draft');
    expect(draftBanner).toHaveTextContent('Sore throat');
    expect(screen.getByText('11/500')).toBeInTheDocument();
  });

  it('shows search idle hint before typing', async () => {
    render(<FrontDesk {...props} />);
    expect(await screen.findByText(/Search to find a patient/i)).toBeInTheDocument();
    expect(screen.getByText(/Type name, phone, NHIS/i)).toBeInTheDocument();
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

  it('shows recalls link when scheduling integration is enabled', () => {
    render(
      <FrontDesk
        {...props}
        scheduledIntegrationEnabled
        calendarUrl="/calendar"
        recallsUrl="/recalls"
      />,
    );
    expect(screen.getByRole('link', { name: /Recalls/i })).toHaveAttribute('href', '/recalls');
  });

  it('opens registration form from Register button', async () => {
    mockFetch.mockImplementation(async (action: string) => {
      if (action === 'front_desk.desk_stats') {
        return { visits_started_today: 0, waiting_count: 0, recent_starts: [] };
      }
      if (action === 'front_desk.recently_viewed') return { recent: [] };
      if (action === 'admin.geo.regions') return { regions: [] };
      if (action === 'patients.dup_check') return { level: 'none', candidates: [] };
      return {};
    });

    render(<FrontDesk {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /^Register$/i }));

    expect(await screen.findByLabelText(/First name/i)).toBeInTheDocument();
    expect(document.getElementById('nc-registration-form')).toBeInTheDocument();
    expect(document.getElementById('nc-front-desk')).toHaveClass('nc-front-desk-registration');
  });

  it('uses pinned registration mode when pinnedPreview is enabled', async () => {
    mockFetch.mockImplementation(async (action: string) => {
      if (action === 'front_desk.desk_stats') {
        return { visits_started_today: 0, waiting_count: 0, recent_starts: [] };
      }
      if (action === 'front_desk.recently_viewed') return { recent: [] };
      if (action === 'patients.search') return { patients: [searchRow] };
      if (action === 'patients.preview') return previewData;
      if (action === 'visit.types') {
        return { visit_types: [{ id: 1, label: 'General OPD', is_default: true }] };
      }
      if (action === 'front_desk.recently_viewed.remember') {
        return { recent: [{ pid: 42, display_name: 'Kwame Boateng', pubpid: 'MRN042' }] };
      }
      if (action === 'admin.geo.regions') return { regions: [] };
      if (action === 'patients.dup_check') return { level: 'none', candidates: [] };
      return {};
    });

    render(<FrontDesk {...props} pinnedPreview />);

    const input = screen.getByPlaceholderText(/Search patient/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Kwame' } });
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    fireEvent.click(await screen.findByRole('button', { name: /Edit profile/i }));
    expect(document.getElementById('nc-front-desk')).toHaveClass('nc-front-desk-registration-pinned');
    expect(screen.getByRole('heading', { name: /Kwame Boateng/i })).toBeInTheDocument();
  });

  it('prompts before switching patient when start visit form is dirty', async () => {
    mockFetch.mockImplementation(async (action: string, opts?: { json?: { q?: string } }) => {
      if (action === 'front_desk.desk_stats') {
        return { visits_started_today: 0, waiting_count: 0, recent_starts: [] };
      }
      if (action === 'front_desk.recently_viewed') return { recent: [] };
      if (action === 'patients.search') {
        const q = String(opts?.json?.q ?? '').toLowerCase();
        if (q.includes('ama')) return { patients: [searchRow2] };
        return { patients: [searchRow] };
      }
      if (action === 'patients.preview') return previewData;
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

    const ccField = await screen.findByLabelText(/Reason for visit/i);
    fireEvent.change(ccField, { target: { value: 'Sore throat' } });

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Ama' } });
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(await screen.findByText(/Switch patient\?/i)).toBeInTheDocument();
  });

  it('opens mobile preview sheet after selecting a patient', async () => {
    mockUseDeskViewport.mockReturnValue('mobile');
    mockFetch.mockImplementation(async (action: string) => {
      if (action === 'front_desk.desk_stats') {
        return { visits_started_today: 0, waiting_count: 0, recent_starts: [] };
      }
      if (action === 'front_desk.recently_viewed') return { recent: [] };
      if (action === 'patients.search') return { patients: [searchRow] };
      if (action === 'patients.preview') return previewData;
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

    fireEvent.click(await screen.findByText('Kwame Boateng'));

    expect(document.getElementById('nc-front-desk-preview-sheet')).toBeInTheDocument();
  });
});
