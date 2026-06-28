import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { DoctorDesk } from './DoctorDesk';
import type { DoctorConsultPayload, DoctorQueueData } from '@core/types';

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

const emptyQueue: DoctorQueueData = {
  visits: [],
  counts: { waiting: 0, done_today: 0, reopenable_today: 0 },
  has_active_consult: false,
  visit_date: '2026-06-27',
  done_today: [],
  reopenable_today: [],
  can_reopen_consult: false,
};

const waitingPatient = {
  id: 7,
  queue_number: '3',
  display_name: 'Kwame Mensah',
  pid: 12,
  pubpid: 'MRN012',
  state: 'ready_for_doctor' as const,
  sex: 'M',
  age_years: '45',
  wait_minutes: 12,
  wait_label: '12m',
  visit_date: '2026-06-27',
  visit_type_label: 'General OPD',
  is_urgent: 0 as const,
  row_version: 2,
};

const consultPayload: DoctorConsultPayload = {
  visit: {
    id: 7,
    pid: 12,
    encounter: 99,
    queue_number: '3',
    state: 'with_doctor',
    visit_type_label: 'General OPD',
    chief_complaint: 'Headache',
    row_version: 3,
  },
  preview: {
    identity: { pid: 12, pubpid: 'MRN012', display_name: 'Kwame Mensah', sex: 'M', age_years: '45' },
    completion: { score: 90, billing_threshold: 70 },
    safety: { allergies_severe: ['Penicillin'] },
    vitals_today: { summary: 'BP 120/80' },
  },
  routing_preview: { detected_lab: false, detected_rx: false, lab_count: 0, rx_count: 0 },
  encounter_signed: true,
  require_esign_before_complete_consult: false,
};

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  facilityId: 1,
  visitBoardUrl: '/visit-board',
};

describe('DoctorDesk', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(emptyQueue);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows idle placeholder while loading queue', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<DoctorDesk {...props} />);
    expect(screen.getByText(/Pick a patient from the queue/i)).toBeInTheDocument();
  });

  it('renders queue patients after poll', async () => {
    mockFetch.mockResolvedValue({
      ...emptyQueue,
      visits: [waitingPatient],
      counts: { waiting: 1, done_today: 0, reopenable_today: 0 },
    });

    render(<DoctorDesk {...props} />);

    await waitFor(() => {
      expect(screen.getByText(/Kwame Mensah/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 waiting/)).toBeInTheDocument();
  });

  it('takes patient and shows consult pane', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingPatient],
        counts: { waiting: 1, done_today: 0, reopenable_today: 0 },
      })
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingPatient],
        counts: { waiting: 1, done_today: 0, reopenable_today: 0 },
      })
      .mockResolvedValueOnce(consultPayload);

    render(<DoctorDesk {...props} />);

    await waitFor(() => screen.getByText(/Kwame Mensah/));
    fireEvent.click(screen.getByText(/Kwame Mensah/));

    await waitFor(() => {
      expect(screen.getByText(/In consult #3/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Supervising provider/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete consult/i })).toBeEnabled();
    expect(screen.getByText(/Allergy: Penicillin/)).toBeInTheDocument();
  });

  it('disables complete when e-sign required and unsigned', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [waitingPatient],
        has_active_consult: true,
        active_consult: waitingPatient,
      })
      .mockResolvedValueOnce({
        ...consultPayload,
        encounter_signed: false,
        require_esign_before_complete_consult: true,
      });

    render(<DoctorDesk {...props} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Complete consult/i })).toBeDisabled();
    });
    expect(screen.getByText(/Unsigned — sign before complete/)).toBeInTheDocument();
  });

  it('shows scope filter when multiDoctorFilters enabled', async () => {
    render(<DoctorDesk {...props} multiDoctorFilters />);

    await waitFor(() => {
      expect(document.getElementById('nc-doctor-scope')).toBeInTheDocument();
    });
  });
});
