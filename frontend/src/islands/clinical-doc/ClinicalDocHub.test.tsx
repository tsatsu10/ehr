import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OeFetchError } from '@core/oeFetch';
import { allowedLenses, firstAllowedLens } from './useClinicalDocPageHeading';
import { ClinicalDocHub } from './ClinicalDocHub';
import type { ClinicalDocProps, ClinicalDocVisitSummary } from './clinicalDocTypes';

const fetchVisitSummaryMock = vi.fn();
vi.mock('./ClinicalDocLensPane', async () => {
  const actual = await vi.importActual<typeof import('./ClinicalDocLensPane')>('./ClinicalDocLensPane');
  return {
    ...actual,
    fetchVisitSummary: (...args: unknown[]) => fetchVisitSummaryMock(...args),
  };
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
