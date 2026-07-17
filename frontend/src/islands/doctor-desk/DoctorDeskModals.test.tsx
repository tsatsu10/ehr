import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoctorDeskModals } from './DoctorDeskModals';
import type { DoctorVisit, PatientPreview } from '@core/types';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn().mockResolvedValue({}),
  OeFetchError: class OeFetchError extends Error {},
}));
vi.mock('./postDoctorAction', () => ({ postDoctorAction: vi.fn() }));

const visit = { id: 7, pid: 12, encounter: 99, queue_number: '3', state: 'with_doctor', row_version: 1 } as DoctorVisit;
const preview = {
  identity: { pid: 12, pubpid: 'MRN012', display_name: 'Kwame Mensah', sex: 'M', age_years: '45' },
  completion: { score: 90, billing_threshold: 70 },
} as PatientPreview;

function baseProps() {
  return {
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    facilityId: 1,
    blocked: false,
    activeVisit: visit,
    activePreview: preview,
    routingPreview: null,
    routingOpen: false,
    labPanelOpen: false,
    formularyRxOpen: false,
    docFavoritesOpen: false,
    reopenTarget: null,
    overrideCard: null,
    overrideSubmitting: false,
    hardAssignOverrideCard: null,
    shortcutNav: {
      runShortcut: vi.fn(),
      rxOverrideOpen: false,
      rxOverrideSubmitting: false,
      rxOverrideError: null,
      confirmRxOverride: vi.fn(),
      closeRxOverride: vi.fn(),
      rxOverridePreview: null,
      rxOverrideVisit: null,
    },
    onRoutingClose: vi.fn(),
    onRoutingCompleted: vi.fn(),
    onReopenClose: vi.fn(),
    onReopened: vi.fn(),
    onReopenConflict: vi.fn(),
    onOverrideClose: vi.fn(),
    onOverrideConfirm: vi.fn(),
    onHardAssignClose: vi.fn(),
    onHardAssignConfirm: vi.fn(),
    onLabPanelClose: vi.fn(),
    onLabPlaced: vi.fn(),
    onLabFullForm: vi.fn(),
    onFormularyRxClose: vi.fn(),
    onFormularyRxPlaced: vi.fn(),
    onFormularyRxFullForm: vi.fn(),
    onDocFavoritesClose: vi.fn(),
    onDocFavoritesError: vi.fn(),
  };
}

describe('DoctorDeskModals', () => {
  it('renders none of its dialogs open by default', () => {
    render(<DoctorDeskModals {...baseProps()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the Routing dialog when routingOpen is true', () => {
    render(<DoctorDeskModals {...baseProps()} routingOpen />);
    expect(screen.getByRole('dialog', { name: 'Confirm routing' })).toBeInTheDocument();
  });

  it('opens the Lab panel dialog when labPanelOpen is true', () => {
    render(<DoctorDeskModals {...baseProps()} labPanelOpen />);
    expect(screen.getByRole('dialog', { name: 'Quick lab order' })).toBeInTheDocument();
  });

  it('opens the Formulary Rx dialog when formularyRxOpen is true', () => {
    render(<DoctorDeskModals {...baseProps()} formularyRxOpen />);
    expect(screen.getByRole('dialog', { name: 'Quick prescribe' })).toBeInTheDocument();
  });

  it('opens the Reopen dialog when a reopenTarget is provided', () => {
    render(
      <DoctorDeskModals
        {...baseProps()}
        reopenTarget={{ id: 44, display_name: 'Ama Owusu', pubpid: 'MRN044', queue_number: '9' } as never}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Reopen consult' })).toBeInTheDocument();
  });

  it('opens the routing-suggested override modal when overrideCard is set', () => {
    render(
      <DoctorDeskModals {...baseProps()} overrideCard={{ routing_suggested_provider_name: 'Dr. Mensah' } as never} />,
    );
    expect(screen.getByText('Take patient suggested for another doctor?')).toBeInTheDocument();
  });

  it('opens the hard-assign override modal when hardAssignOverrideCard is set', () => {
    render(
      <DoctorDeskModals
        {...baseProps()}
        hardAssignOverrideCard={{ hard_assigned_provider_name: 'Dr. Boateng' } as never}
      />,
    );
    expect(screen.getByText('Take patient assigned to another doctor?')).toBeInTheDocument();
  });
});
