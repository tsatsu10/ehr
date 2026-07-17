import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OeFetchError } from '@core/oeFetch';
import { allowedLenses, firstAllowedLens } from './useClinicalDocPageHeading';
import { ClinicalDocHub } from './ClinicalDocHub';
import { clearCertificateCachesForTest } from './CertificateDrawer';
import { clearInstructionsCachesForTest } from './ClinicalInstructionsDrawer';
import { clearScreeningCachesForTest } from './ScreeningDrawer';
import { clearVitalsCachesForTest } from './VitalsDrawer';
import type { ClinicalDocProps, ClinicalDocVisitSummary } from './clinicalDocTypes';

const fetchVisitSummaryMock = vi.fn();
vi.mock('./ClinicalDocLensPane', async () => {
  const actual = await vi.importActual<typeof import('./ClinicalDocLensPane')>('./ClinicalDocLensPane');
  return {
    ...actual,
    fetchVisitSummary: (...args: unknown[]) => fetchVisitSummaryMock(...args),
  };
});

const oeFetchMock = vi.fn();
vi.mock('@core/oeFetch', async () => {
  const actual = await vi.importActual<typeof import('@core/oeFetch')>('@core/oeFetch');
  return { ...actual, oeFetch: (...args: unknown[]) => oeFetchMock(...args) };
});

const baseProps: ClinicalDocProps = {
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  doctorDeskUrl: '/module/public/doctor.php',
  initialTab: 'visit',
  canVisit: true,
  canConsult: true,
  canScreening: false,
  canNursing: false,
  canOrders: true,
  canSpecialty: false,
};

function summary(overrides: Partial<ClinicalDocVisitSummary> = {}): ClinicalDocVisitSummary {
  return {
    visit: { id: 72, queue_number: 3, state: 'with_doctor', encounter: 501, pid: 12 },
    patient: { display_name: 'Test Patient', pubpid: 'PT-12' },
    sign_status: { encounter_signed: false, require_esign_before_complete_consult: true },
    lenses: ['visit'],
    cards: [],
    ...overrides,
  };
}

describe('ClinicalDocHub', () => {
  beforeEach(() => {
    clearScreeningCachesForTest();
    clearInstructionsCachesForTest();
    clearVitalsCachesForTest();
    clearCertificateCachesForTest();
    // The hub syncs ?visit_id into the URL on render — reset it or one test's
    // visit leaks into the next test's readVisitIdFromUrl().
    window.history.replaceState({}, '', '/');
    fetchVisitSummaryMock.mockReset();
    oeFetchMock.mockReset();
  });

  it('opens the native vitals drawer from a Vitals card', async () => {
    fetchVisitSummaryMock.mockResolvedValue(summary({
      cards: [{
        id: 'nursing_vitals', lens: 'visit', formdir: 'vitals',
        kind: 'form', title: 'Vitals', description: 'BP, temperature, SpO₂, etc.', started: true, form_id: 9,
      }],
    }));
    oeFetchMock.mockResolvedValue({
      enabled: true, visit_id: 72, vitals_id: 9, saved: true,
      values: { bps: 120 },
      fields: { required: ['bps'], units: { bps: 'mmHg' }, labels: { bps: 'BP systolic' } },
    });
    render(<ClinicalDocHub {...baseProps} initialVisitId={72} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('dialog', { name: 'Vitals' })).toBeInTheDocument();
    expect(oeFetchMock).toHaveBeenCalledWith('clinical_doc.vitals_get', expect.objectContaining({
      params: { visit_id: 72 },
    }));
  });

  it('shows the empty state with no visit_id and no oeFetch call', () => {
    render(<ClinicalDocHub {...baseProps} initialVisitId={null} />);
    expect(screen.getByText(/Open documentation from Doctor Desk/i)).toBeInTheDocument();
    expect(fetchVisitSummaryMock).not.toHaveBeenCalled();
  });

  it('renders patient context and cards on a successful load', async () => {
    fetchVisitSummaryMock.mockResolvedValue(summary({
      cards: [{ id: 'visit_soap', lens: 'visit', formdir: 'soap', kind: 'form', title: 'Consult note', description: '' }],
    }));
    render(<ClinicalDocHub {...baseProps} initialVisitId={72} />);
    expect(await screen.findByText('Test Patient')).toBeInTheDocument();
    expect(screen.getByText('Consult note')).toBeInTheDocument();
  });

  it('shows a tailored message instead of a raw error when the visit has no encounter yet', async () => {
    fetchVisitSummaryMock.mockRejectedValue(
      new OeFetchError('No encounter on visit', 409, 'no_encounter_on_visit'),
    );
    render(<ClinicalDocHub {...baseProps} initialVisitId={72} />);
    expect(await screen.findByText(/hasn.t started yet/i)).toBeInTheDocument();
    expect(screen.queryByText('No encounter on visit')).not.toBeInTheDocument();
  });

  it('shows the raw error message for any other failure', async () => {
    fetchVisitSummaryMock.mockRejectedValue(new Error('Network down'));
    render(<ClinicalDocHub {...baseProps} initialVisitId={72} />);
    await waitFor(() => expect(screen.getByText('Network down')).toBeInTheDocument());
  });

  it('opens the native instructions drawer from the card instead of navigating', async () => {
    fetchVisitSummaryMock.mockResolvedValue(summary({
      lenses: ['visit', 'nursing'],
      cards: [{
        id: 'nursing_ci', lens: 'visit', formdir: 'clinical_instructions',
        kind: 'form', title: 'Clinical instructions', description: 'Patient education notes.',
      }],
    }));
    oeFetchMock.mockResolvedValue({
      enabled: true, visit_id: 72, form_id: null, instruction: '', snippets: [],
    });
    render(<ClinicalDocHub {...baseProps} initialVisitId={72} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open form' }));
    expect(await screen.findByRole('dialog', { name: 'Clinical instructions' })).toBeInTheDocument();
    expect(oeFetchMock).toHaveBeenCalledWith('clinical_doc.instructions_get', expect.objectContaining({
      params: { visit_id: 72 },
    }));
  });

  it('auto-opens the native drawer when landed with ?open_form=clinical_instructions', async () => {
    fetchVisitSummaryMock.mockResolvedValue(summary());
    oeFetchMock.mockResolvedValue({
      enabled: true, visit_id: 72, form_id: null, instruction: '', snippets: [],
    });
    window.history.replaceState({}, '', '/clinical-doc?visit_id=72&open_form=clinical_instructions');
    render(<ClinicalDocHub {...baseProps} initialVisitId={72} />);
    expect(await screen.findByRole('dialog', { name: 'Clinical instructions' })).toBeInTheDocument();
    // Param is stripped so a refresh won't reopen it.
    expect(new URLSearchParams(window.location.search).get('open_form')).toBeNull();
  });

  it('auto-opens the screening drawer when landed with ?open_form=phq9', async () => {
    fetchVisitSummaryMock.mockResolvedValue(summary());
    oeFetchMock.mockResolvedValue({
      instrument: { id: 'phq9', title: 'PHQ-9', subtitle: 'Depression screen', stem: '', options: [], max_score: 27, items: [], bands: [], flag_rules: [] },
      answers: {}, saved: false,
    });
    window.history.replaceState({}, '', '/clinical-doc?visit_id=72&open_form=phq9');
    render(<ClinicalDocHub {...baseProps} initialVisitId={72} />);
    expect(await screen.findByRole('dialog', { name: /PHQ-9/ })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('open_form')).toBeNull();
  });

  it('opens the native screening drawer from a PHQ-9 card', async () => {
    fetchVisitSummaryMock.mockResolvedValue(summary({
      lenses: ['visit', 'screening'],
      cards: [{
        id: 'screening_phq9', lens: 'visit', formdir: 'phq9',
        kind: 'form', title: 'PHQ-9', description: 'Depression screen.',
      }],
    }));
    oeFetchMock.mockResolvedValue({
      instrument: { id: 'phq9', title: 'PHQ-9', subtitle: 'Depression screen', stem: '', options: [], max_score: 27, items: [], bands: [], flag_rules: [] },
      answers: {}, saved: false,
    });
    render(<ClinicalDocHub {...baseProps} initialVisitId={72} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open form' }));
    expect(await screen.findByRole('dialog', { name: /PHQ-9/ })).toBeInTheDocument();
    expect(oeFetchMock).toHaveBeenCalledWith('clinical_doc.screening_get', expect.objectContaining({
      params: { visit_id: 72, instrument: 'phq9' },
    }));
  });

  it('routes the "Add form" picker to the native drawer too', async () => {
    fetchVisitSummaryMock.mockResolvedValue(summary({
      addable_forms: [{
        id: 'add_ci', lens: 'nursing', source_lens: 'nursing', formdir: 'clinical_instructions',
        kind: 'form', title: 'Clinical instructions', description: 'Patient education notes.',
      }],
    }));
    oeFetchMock.mockResolvedValue({
      enabled: true, visit_id: 72, form_id: null, instruction: '', snippets: [],
    });
    render(<ClinicalDocHub {...baseProps} initialVisitId={72} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add form' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('dialog', { name: 'Clinical instructions' })).toBeInTheDocument();
    expect(oeFetchMock).toHaveBeenCalledWith('clinical_doc.instructions_get', expect.objectContaining({
      params: { visit_id: 72 },
    }));
  });
});

describe('clinical-doc page heading', () => {
  it('builds allowed lens tabs from props', () => {
    const tabs = allowedLenses({
      canVisit: true,
      canConsult: true,
      canScreening: false,
      canNursing: false,
      canOrders: true,
      canSpecialty: false,
    });
    expect(tabs).toEqual(['visit', 'consult', 'orders']);
  });

  it('falls back when initial tab is not allowed', () => {
    expect(firstAllowedLens('specialty', ['visit', 'consult'])).toBe('visit');
  });
});

describe('clinical-doc visit tab types', () => {
  it('accepts sign overview payload shape', () => {
    const overview = {
      encounter_signed: false,
      started_count: 2,
      signed_count: 1,
      unsigned_count: 1,
      required_forms: [{ formdir: 'soap', title: 'Consult note', started: true }],
    };
    expect(overview.required_forms[0]?.title).toBe('Consult note');
  });
});
