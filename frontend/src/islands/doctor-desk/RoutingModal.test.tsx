import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { postDoctorAction } from './postDoctorAction';
import { RoutingModal } from './RoutingModal';
import type { DoctorVisit, PatientPreview } from '@core/types';

vi.mock('./postDoctorAction', () => ({ postDoctorAction: vi.fn() }));

const mockedPost = vi.mocked(postDoctorAction);

const visit = { id: 7, pid: 12, encounter: 99, queue_number: '3', state: 'with_doctor', row_version: 5 } as DoctorVisit;
const preview = {
  identity: { pid: 12, pubpid: 'MRN012', display_name: 'Kwame Mensah', sex: 'M', age_years: '45' },
  completion: { score: 90, billing_threshold: 70 },
} as PatientPreview;

function baseProps() {
  return {
    open: true,
    visit,
    preview,
    routingPreview: { detected_lab: false, detected_rx: false, lab_count: 0, rx_count: 0 },
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    facilityId: 1,
    blocked: false,
    onClose: vi.fn(),
    onCompleted: vi.fn(),
  };
}

describe('RoutingModal', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('renders nothing without a visit or preview', () => {
    const { container } = render(<RoutingModal {...baseProps()} visit={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('pre-checks Send to lab when the routing preview detected a lab order', () => {
    render(<RoutingModal {...baseProps()} routingPreview={{ detected_lab: true, detected_rx: false, lab_count: 1, rx_count: 0 }} />);
    expect(screen.getByLabelText('Send to lab')).toBeChecked();
    expect(screen.getByLabelText('Send to pharmacy')).not.toBeChecked();
  });

  it('does not pre-check pharmacy when both lab and rx are detected (lab wins)', () => {
    render(<RoutingModal {...baseProps()} routingPreview={{ detected_lab: true, detected_rx: true, lab_count: 1, rx_count: 1 }} />);
    expect(screen.getByLabelText('Send to lab')).toBeChecked();
    expect(screen.getByLabelText('Send to pharmacy')).not.toBeChecked();
  });

  it('blocks confirm with an error when both lab and pharmacy are checked', async () => {
    render(<RoutingModal {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('Send to lab'));
    fireEvent.click(screen.getByLabelText('Send to pharmacy'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and route' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose lab or pharmacy routing, not both');
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('completes the consult on success', async () => {
    mockedPost.mockResolvedValue({ ok: true, data: {} } as never);
    const onCompleted = vi.fn();
    render(<RoutingModal {...baseProps()} onCompleted={onCompleted} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm and route' }));

    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
    expect(mockedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'doctor.complete',
        body: expect.objectContaining({ visit_id: 7, row_version: 5, needs_lab: false, needs_rx: false }),
      }),
    );
  });

  it('opens the encounter in a new tab and shows an error on encounter_unsigned 409', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockedPost.mockResolvedValue({
      ok: false,
      status: 409,
      message: 'Sign documentation first',
      data: { code: 'encounter_unsigned', encounter_url: '/encounter/7' },
    } as never);

    render(<RoutingModal {...baseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and route' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign documentation first');
    expect(openSpy).toHaveBeenCalledWith('/encounter/7', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('shows a plain error for other failures', async () => {
    mockedPost.mockResolvedValue({ ok: false, status: 400, message: 'Complete failed' } as never);
    render(<RoutingModal {...baseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and route' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Complete failed');
  });
});
