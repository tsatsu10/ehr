import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { TriageDesk } from './TriageDesk';
import type { TriageQueueData, TriageSelectData, VitalsRules } from '@core/types';

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

const mockRules: VitalsRules = {
  temperature_unit: '°C',
  required: ['bps', 'bpd', 'pulse', 'temperature', 'weight'],
  fields: {
    bps:                { label: 'BP sys',      min: 40,  max: 300, step: 1,   required: true },
    bpd:                { label: 'BP dia',      min: 20,  max: 200, step: 1,   required: true },
    pulse:              { label: 'Pulse',       min: 20,  max: 250, step: 1,   required: true },
    temperature:        { label: 'Temperature', min: 30,  max: 45,  step: 0.1, required: true },
    weight:             { label: 'Weight',      min: 0.5, max: 500, step: 0.1, required: true },
    height:             { label: 'Height',      min: 20,  max: 280, step: 0.1, required: false },
    oxygen_saturation:  { label: 'SpO2',        min: 50,  max: 100, step: 1,   required: false },
    respiration:        { label: 'Resp. rate',  min: 4,   max: 60,  step: 1,   required: false },
    pain:               { label: 'Pain',        min: 0,   max: 10,  step: 1,   required: false },
  },
};

const emptyQueue: TriageQueueData = {
  visits: [],
  counts: { waiting: 0, in_triage: 0 },
  visit_date: '2026-06-27',
};

const waitingPatient = {
  id: 42,
  queue_number: '1',
  display_name: 'Amara Osei',
  pid: 5,
  pubpid: 'MRN001',
  state: 'waiting' as const,
  sex: 'F',
  age_years: '34',
  wait_minutes: 8,
  wait_label: '8m',
  visit_date: '2026-06-27',
  visit_type_label: 'General OPD',
  is_urgent: 0 as const,
};

const selectResponse: TriageSelectData = {
  visit: {
    id: 42,
    pid: 5,
    queue_number: '1',
    state: 'waiting' as const,
    visit_type_label: 'General OPD',
    chief_complaint: '',
    row_version: 1,
  },
  preview: {
    identity: { pid: 5, pubpid: 'MRN001', display_name: 'Amara Osei', sex: 'F', age_years: '34' },
    completion: { score: 85, billing_threshold: 70, missing_labels: [] },
    safety: { allergies_severe: [] },
    vitals_today: { vitals_missing_today: true },
  },
  form_vitals: {},
  vitals: [],
  vitals_warnings: [],
};

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  facilityId: 1,
  vitalsRules: mockRules,
};

describe('TriageDesk', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetch.mockResolvedValue(emptyQueue);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('shows idle placeholder while loading queue', async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<TriageDesk {...props} />);
    expect(screen.getByText(/loading queue/i)).toBeInTheDocument();
    expect(screen.getByText(/select a patient/i)).toBeInTheDocument();
  });

  it('shows empty queue message after successful empty fetch', async () => {
    render(<TriageDesk {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/no patients in the triage queue/i)).toBeInTheDocument()
    );
  });

  it('renders a waiting patient card in the queue', async () => {
    mockFetch.mockResolvedValue({
      ...emptyQueue,
      visits: [waitingPatient],
      counts: { waiting: 1, in_triage: 0 },
    });
    render(<TriageDesk {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/Amara Osei/)).toBeInTheDocument()
    );
  });

  // ── Queue error ───────────────────────────────────────────────────────────

  it('shows queue error on initial fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<TriageDesk {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    );
  });

  // ── Select patient ────────────────────────────────────────────────────────

  it('opens active pane with form mode when waiting patient is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({ ...emptyQueue, visits: [waitingPatient], counts: { waiting: 1, in_triage: 0 } })
      .mockResolvedValueOnce(selectResponse) // triage.select
      .mockResolvedValue(emptyQueue); // subsequent queue polls

    render(<TriageDesk {...props} />);
    await waitFor(() => screen.getByText(/Amara Osei/));

    fireEvent.click(screen.getByRole('button', { name: /Amara Osei/ }));
    await waitFor(() => screen.getByText(/MRN001/));

    // Vitals form should be visible
    expect(screen.getByLabelText(/BP sys/i)).toBeInTheDocument();
    // Start triage button (visit is in 'waiting' state)
    expect(screen.getByRole('button', { name: /start triage/i })).toBeInTheDocument();
  });

  it('shows chief complaint on banner when reception captured CC', async () => {
    mockFetch
      .mockResolvedValueOnce({ ...emptyQueue, visits: [waitingPatient], counts: { waiting: 1, in_triage: 0 } })
      .mockResolvedValueOnce({
        ...selectResponse,
        visit: { ...selectResponse.visit, chief_complaint: 'Persistent cough' },
      })
      .mockResolvedValue(emptyQueue);

    render(<TriageDesk {...props} />);
    await waitFor(() => screen.getByText(/Amara Osei/));
    fireEvent.click(screen.getByRole('button', { name: /Amara Osei/ }));

    await waitFor(() => {
      const banner = document.getElementById('nc-banner-chief-complaint');
      expect(banner).toHaveTextContent('Persistent cough');
      expect(screen.getByText(/Reason for visit:/)).toBeInTheDocument();
    });
  });

  it('shows Save vitals button when patient is in_triage', async () => {
    const inTriageSelect: TriageSelectData = {
      ...selectResponse,
      visit: { ...selectResponse.visit, state: 'in_triage' as const },
    };
    mockFetch
      .mockResolvedValueOnce({ ...emptyQueue, visits: [{ ...waitingPatient, state: 'in_triage' as const }], counts: { waiting: 0, in_triage: 1 } })
      .mockResolvedValueOnce(inTriageSelect)
      .mockResolvedValue(emptyQueue);

    render(<TriageDesk {...props} />);
    await waitFor(() => screen.getByText(/Amara Osei/));
    fireEvent.click(screen.getByRole('button', { name: /Amara Osei/ }));
    await waitFor(() => screen.getByRole('button', { name: /save vitals/i }));
  });

  // ── Interrupt banner ──────────────────────────────────────────────────────

  it('shows interrupt banner and resets pane on stale_visit conflict from select', async () => {
    const { OeFetchError } = await import('@core/oeFetch');
    mockFetch
      .mockResolvedValueOnce({ ...emptyQueue, visits: [waitingPatient], counts: { waiting: 1, in_triage: 0 } })
      .mockRejectedValueOnce(new OeFetchError('Visit stale — updated elsewhere', 409, 'api_error'))
      .mockResolvedValue(emptyQueue);

    render(<TriageDesk {...props} />);
    await waitFor(() => screen.getByText(/Amara Osei/));
    fireEvent.click(screen.getByRole('button', { name: /Amara Osei/ }));

    await waitFor(() =>
      expect(screen.getByText(/visit stale/i)).toBeInTheDocument()
    );
    // Idle pane restored
    expect(screen.getByText(/select a patient/i)).toBeInTheDocument();
  });

  it('dismisses interrupt banner and returns to idle on button click', async () => {
    const { OeFetchError } = await import('@core/oeFetch');
    mockFetch
      .mockResolvedValueOnce({ ...emptyQueue, visits: [waitingPatient], counts: { waiting: 1, in_triage: 0 } })
      .mockRejectedValueOnce(new OeFetchError('Visit stale', 409, 'api_error'))
      .mockResolvedValue(emptyQueue);

    render(<TriageDesk {...props} />);
    await waitFor(() => screen.getByText(/Amara Osei/));
    fireEvent.click(screen.getByRole('button', { name: /Amara Osei/ }));
    await waitFor(() => screen.getByText(/visit stale/i));

    fireEvent.click(screen.getByRole('button', { name: /return to queue/i }));
    await waitFor(() =>
      expect(screen.queryByText(/visit stale/i)).not.toBeInTheDocument()
    );
  });

  // ── Counts strip ──────────────────────────────────────────────────────────

  it('renders counts strip with waiting and in_triage numbers', async () => {
    mockFetch.mockResolvedValue({
      ...emptyQueue,
      visits: [waitingPatient],
      counts: { waiting: 1, in_triage: 2 },
    });
    render(<TriageDesk {...props} />);
    await waitFor(() => {
      const bar = screen.getByLabelText(/Triage desk status/i);
      expect(bar).toHaveTextContent('1');
      expect(bar).toHaveTextContent('Waiting');
      expect(bar).toHaveTextContent('2');
      expect(bar).toHaveTextContent('In triage');
    });
  });

  // ── Urgent badge ──────────────────────────────────────────────────────────

  it('shows URGENT badge on urgent cards', async () => {
    mockFetch.mockResolvedValue({
      ...emptyQueue,
      visits: [{ ...waitingPatient, is_urgent: 1 as const }],
      counts: { waiting: 1, in_triage: 0 },
    });
    render(<TriageDesk {...props} />);
    await waitFor(() =>
      expect(screen.getByText('URGENT')).toBeInTheDocument()
    );
  });

  it('allows clicking in_triage visits with no assigned nurse (orphan row)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ...emptyQueue,
        visits: [{ ...waitingPatient, state: 'in_triage' as const, triage_mine: false }],
        counts: { waiting: 0, in_triage: 1 },
      })
      .mockResolvedValueOnce(selectResponse)
      .mockResolvedValue(emptyQueue);

    render(<TriageDesk {...props} />);
    const card = await waitFor(() => screen.getByRole('button', { name: /Amara Osei/ }));
    expect(card).not.toBeDisabled();
    fireEvent.click(card);
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('triage.select', expect.anything())
    );
  });

  it('disables cards held by another nurse', async () => {
    mockFetch.mockResolvedValue({
      ...emptyQueue,
      visits: [{
        ...waitingPatient,
        state: 'in_triage' as const,
        triage_mine: false,
        triage_actor_name: 'Nurse Ada',
      }],
      counts: { waiting: 0, in_triage: 1 },
    });
    render(<TriageDesk {...props} />);
    const card = await waitFor(() => screen.getByRole('button', { name: /Amara Osei/ }));
    expect(card).toBeDisabled();
  });

  // ── Vitals form validation ─────────────────────────────────────────────────

  it('shows validation errors when Save vitals is clicked with empty required fields', async () => {
    const inTriageSelect: TriageSelectData = {
      ...selectResponse,
      visit: { ...selectResponse.visit, state: 'in_triage' as const },
    };
    mockFetch
      .mockResolvedValueOnce({ ...emptyQueue, visits: [{ ...waitingPatient, state: 'in_triage' as const }], counts: { waiting: 0, in_triage: 1 } })
      .mockResolvedValueOnce(inTriageSelect)
      .mockResolvedValue(emptyQueue);

    render(<TriageDesk {...props} />);
    await waitFor(() => screen.getByText(/Amara Osei/));
    fireEvent.click(screen.getByRole('button', { name: /Amara Osei/ }));
    await waitFor(() => screen.getByRole('button', { name: /save vitals/i }));

    // Click Save with no values — required fields should show errors
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));
    await waitFor(() =>
      expect(screen.getByText(/BP sys is required/i)).toBeInTheDocument()
    );
  });

  // ── Save vitals success ────────────────────────────────────────────────────

  it('shows saved panel after successful save_vitals', async () => {
    const inTriageSelect: TriageSelectData = {
      ...selectResponse,
      visit: { ...selectResponse.visit, state: 'in_triage' as const },
    };
    const savedVitals = { bps: '120', bpd: '80', pulse: '72', temperature: '36.5', weight: '70' };
    const saveResponse = {
      visit: { ...inTriageSelect.visit },
      form_vitals: savedVitals,
      vitals_warnings: [],
      last_vitals_today: [{}],
      vitals_abnormal_today: false,
    };

    mockFetch
      .mockResolvedValueOnce({ ...emptyQueue, visits: [{ ...waitingPatient, state: 'in_triage' as const }], counts: { waiting: 0, in_triage: 1 } })
      .mockResolvedValueOnce(inTriageSelect)   // triage.select
      .mockResolvedValueOnce(emptyQueue)       // fetchQueue after select
      .mockResolvedValueOnce(saveResponse)     // triage.save_vitals
      .mockResolvedValue(emptyQueue);

    render(<TriageDesk {...props} />);
    await waitFor(() => screen.getByText(/Amara Osei/));
    fireEvent.click(screen.getByRole('button', { name: /Amara Osei/ }));
    await waitFor(() => screen.getByRole('button', { name: /save vitals/i }));

    // Fill required fields
    for (const [name, val] of Object.entries(savedVitals)) {
      fireEvent.change(screen.getByRole('spinbutton', { name: new RegExp(name === 'bps' ? 'BP sys' : name === 'bpd' ? 'BP dia' : name, 'i') }), { target: { value: val } });
    }

    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));
    await waitFor(() =>
      expect(screen.getByText(/Vitals saved at/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /send to doctor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record another set/i })).toBeInTheDocument();
  });

  // ── Send to doctor ─────────────────────────────────────────────────────────

  it('resets pane to idle after successful send_doctor', async () => {
    const inTriageSelect: TriageSelectData = {
      ...selectResponse,
      visit: { ...selectResponse.visit, state: 'in_triage' as const },
      vitals: [{}],
      form_vitals: { bps: '120', bpd: '80', pulse: '72', temperature: '36.5', weight: '70' },
    };
    const readyVisit = {
      ...inTriageSelect.visit,
      state: 'ready_for_doctor' as const,
      row_version: 2,
    };

    mockFetch
      .mockResolvedValueOnce({ ...emptyQueue, visits: [{ ...waitingPatient, state: 'in_triage' as const }], counts: { waiting: 0, in_triage: 1 } })
      .mockResolvedValueOnce(inTriageSelect)  // triage.select → saved mode (has vitals)
      .mockResolvedValueOnce(emptyQueue)      // fetchQueue after select
      .mockResolvedValueOnce(inTriageSelect)  // triage.select refresh before send_doctor
      .mockResolvedValueOnce({ visit: readyVisit }) // triage.send_doctor
      .mockResolvedValue(emptyQueue);

    render(<TriageDesk {...props} />);
    await waitFor(() => screen.getByText(/Amara Osei/));
    fireEvent.click(screen.getByRole('button', { name: /Amara Osei/ }));
    await waitFor(() => screen.getByRole('button', { name: /send to doctor/i }));

    fireEvent.click(screen.getByRole('button', { name: /send to doctor/i }));
    await waitFor(() =>
      expect(screen.getByText(/select a patient/i)).toBeInTheDocument()
    );
  });

  // ── vitalsRules null guard ─────────────────────────────────────────────────

  it('shows loading message when vitalsRules is not yet available', async () => {
    const inTriageSelect: TriageSelectData = {
      ...selectResponse,
      visit: { ...selectResponse.visit, state: 'in_triage' as const },
      vitals_form_rules: undefined,
    };
    mockFetch
      .mockResolvedValueOnce({ ...emptyQueue, visits: [{ ...waitingPatient, state: 'in_triage' as const }], counts: { waiting: 0, in_triage: 1 } })
      .mockResolvedValueOnce(inTriageSelect)
      .mockResolvedValue(emptyQueue);

    // Render WITHOUT vitalsRules prop so rules start undefined
    render(<TriageDesk {...{ ...props, vitalsRules: undefined }} />);
    await waitFor(() => screen.getByText(/Amara Osei/));
    fireEvent.click(screen.getByRole('button', { name: /Amara Osei/ }));
    await waitFor(() =>
      expect(screen.getByText(/Vitals rules are still loading/i)).toBeInTheDocument()
    );
  });

  // ── Record another set ────────────────────────────────────────────────────

  it('returns to form mode when Record another set is clicked', async () => {
    const inTriageSelect: TriageSelectData = {
      ...selectResponse,
      visit: { ...selectResponse.visit, state: 'in_triage' as const },
      vitals: [{}],
      form_vitals: { bps: '120', bpd: '80', pulse: '72', temperature: '36.5', weight: '70' },
    };

    mockFetch
      .mockResolvedValueOnce({ ...emptyQueue, visits: [{ ...waitingPatient, state: 'in_triage' as const }], counts: { waiting: 0, in_triage: 1 } })
      .mockResolvedValueOnce(inTriageSelect)
      .mockResolvedValue(emptyQueue);

    render(<TriageDesk {...props} />);
    await waitFor(() => screen.getByText(/Amara Osei/));
    fireEvent.click(screen.getByRole('button', { name: /Amara Osei/ }));
    await waitFor(() => screen.getByRole('button', { name: /record another set/i }));

    fireEvent.click(screen.getByRole('button', { name: /record another set/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save vitals/i })).toBeInTheDocument()
    );
  });

  // ── Shared device session (Phase 2B) ───────────────────────────────────────

  it('blocks save when shared-device session is mismatched', async () => {
    const inTriageSelect: TriageSelectData = {
      ...selectResponse,
      visit: { ...selectResponse.visit, state: 'in_triage' as const },
    };

    // Route fetches by action — queue + probe run in parallel on mount.
    mockFetch.mockImplementation((action: string) => {
      if (action === 'triage.queue') {
        return Promise.resolve({
          ...emptyQueue,
          visits: [{ ...waitingPatient, state: 'in_triage' as const }],
          counts: { waiting: 0, in_triage: 1 },
        });
      }
      if (action === 'desk.shared_session_probe') {
        return Promise.resolve({
          enabled: true,
          mismatch: true,
          session: { pid: 1, display_name: 'Other Patient', pubpid: 'MRN999' },
          visit: { visit_id: 42, queue_number: 1, display_name: 'Amara Osei', pubpid: 'MRN001' },
        });
      }
      if (action === 'triage.select') return Promise.resolve(inTriageSelect);
      if (action === 'triage.save_vitals') {
        return Promise.reject(new Error('save should not be called when blocked'));
      }
      return Promise.resolve(emptyQueue);
    });

    sessionStorage.setItem('triage_desk_active_visit_id', '42');

    render(<TriageDesk {...props} sharedDeviceWarning pollMs={999_999} />);

    await waitFor(() =>
      expect(screen.getByText(/browser session is on another patient/i)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /#1 Amara Osei/ }));
    await waitFor(() => screen.getByRole('button', { name: /save vitals/i }));

    const saveCallsBefore = mockFetch.mock.calls.filter(([a]) => a === 'triage.save_vitals').length;
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));
    const saveCallsAfter = mockFetch.mock.calls.filter(([a]) => a === 'triage.save_vitals').length;
    expect(saveCallsAfter).toBe(saveCallsBefore);
  });
});
