import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorActivePane } from './DoctorActivePane';
import type { DoctorConsultPayload } from '@core/types';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn().mockResolvedValue({}),
  OeFetchError: class OeFetchError extends Error {},
}));

function payload(overrides: Partial<DoctorConsultPayload> = {}): DoctorConsultPayload {
  return {
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
    },
    routing_preview: { detected_lab: false, detected_rx: false, lab_count: 0, rx_count: 0 },
    encounter_signed: true,
    require_esign_before_complete_consult: false,
    ...overrides,
  } as DoctorConsultPayload;
}

function baseProps() {
  return {
    mode: 'consult' as const,
    payload: payload(),
    signMeta: {
      encounter_signed: true,
      require_esign_before_complete_consult: false,
    },
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    facilityId: 1,
    blocked: false,
    onComplete: vi.fn(),
    onOpenLabPanel: vi.fn(),
    onOpenFormularyRx: vi.fn(),
    runShortcut: vi.fn(),
    onShortcutError: vi.fn(),
    onSupervisorUpdated: vi.fn(),
    onSupervisorNotice: vi.fn(),
  };
}

describe('DoctorActivePane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty placeholder in idle mode', () => {
    render(<DoctorActivePane {...baseProps()} mode="idle" payload={null} signMeta={null} />);
    expect(screen.getByText(/Choose a patient from the queue/i)).toBeInTheDocument();
  });

  it('renders a loading state in loading mode', () => {
    render(<DoctorActivePane {...baseProps()} mode="loading" payload={null} signMeta={null} />);
    expect(screen.getByText(/Loading consult/i)).toBeInTheDocument();
  });

  it('renders an error alert in error mode', () => {
    render(<DoctorActivePane {...baseProps()} mode="error" payload={null} signMeta={null} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load consult.');
  });

  it('renders the consult hero with queue number and patient name', () => {
    render(<DoctorActivePane {...baseProps()} />);
    expect(screen.getByText(/Active consult · #3 Kwame Mensah/)).toBeInTheDocument();
  });

  it('disables Complete consult when e-sign is required and the encounter is unsigned', () => {
    render(
      <DoctorActivePane
        {...baseProps()}
        signMeta={{ encounter_signed: false, require_esign_before_complete_consult: true }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Complete consult' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'Sign documentation in the encounter first');
  });

  it('enables Complete consult when not blocked and e-sign is satisfied', () => {
    render(<DoctorActivePane {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Complete consult' })).toBeEnabled();
  });

  it('does not show a prescriptions section when pharm ops and rx print are both off', () => {
    render(<DoctorActivePane {...baseProps()} />);
    expect(screen.queryByText('Prescriptions')).not.toBeInTheDocument();
    expect(screen.queryByText('Prescriptions (stock)')).not.toBeInTheDocument();
  });

  it('labels the Rx list link "Open Rx list" for a stock URL', () => {
    render(
      <DoctorActivePane
        {...baseProps()}
        payload={payload({
          rx_print_enabled: true,
          rx_list_url: '/controller.php?prescription&list&id=12',
        })}
      />,
    );
    const link = screen.getByRole('link', { name: 'Open Rx list' });
    expect(link).toHaveAttribute('href', '/controller.php?prescription&list&id=12');
  });

  it('labels the Rx list link "Rx history" for a native rx-history.php URL', () => {
    render(
      <DoctorActivePane
        {...baseProps()}
        payload={payload({
          rx_print_enabled: true,
          rx_list_url: '/interface/modules/custom_modules/oe-module-new-clinic/public/rx-history.php?pid=12',
        })}
      />,
    );
    expect(screen.getByRole('link', { name: 'Rx history' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Rx list' })).not.toBeInTheDocument();
  });

  it('omits the Rx list link entirely when no rx_list_url is provided', () => {
    render(<DoctorActivePane {...baseProps()} payload={payload({ pharm_ops_enabled: true })} />);
    expect(screen.getByText('Prescriptions (stock)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Rx/i })).not.toBeInTheDocument();
  });

  it('shows the Visit Board link when a visitBoardUrl is provided', () => {
    render(<DoctorActivePane {...baseProps()} visitBoardUrl="/visit-board" />);
    expect(screen.getByRole('link', { name: 'View on Visit Board' })).toHaveAttribute('href', '/visit-board');
  });
});
