import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { postDoctorAction } from './postDoctorAction';
import { LabPanelModal, labPanelPlaceNotice, labReturnNotice } from './LabPanelModal';
import type { DoctorVisit } from '@core/types';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
  OeFetchError: class OeFetchError extends Error {},
}));
vi.mock('./postDoctorAction', () => ({ postDoctorAction: vi.fn() }));

const mockedFetch = vi.mocked(oeFetch);
const mockedPost = vi.mocked(postDoctorAction);

const visit = { id: 7, pid: 12, encounter: 99, queue_number: '3', state: 'with_doctor', row_version: 1 } as DoctorVisit;

function baseProps() {
  return {
    open: true,
    visit,
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    facilityId: 1,
    blocked: false,
    onClose: vi.fn(),
    onPlaced: vi.fn(),
    onFullLabForm: vi.fn(),
  };
}

describe('LabPanelModal', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedPost.mockReset();
  });

  it('renders nothing without a visit', () => {
    const { container } = render(<LabPanelModal {...baseProps()} visit={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('loads and lists tests, and shows the provider hint', async () => {
    mockedFetch.mockResolvedValue({
      has_catalog: true,
      provider_name: 'Lab',
      tests: [{ procedure_type_id: 1, name: 'CBC', code: 'CBC01', has_fee: true, fee_amount: 10, is_starter: true }],
    } as never);

    render(<LabPanelModal {...baseProps()} />);

    expect(await screen.findByLabelText(/CBC/)).toBeInTheDocument();
    expect(screen.getByText(/From Lab/)).toBeInTheDocument();
  });

  it('marks a test with no fee mapped', async () => {
    mockedFetch.mockResolvedValue({
      has_catalog: true,
      tests: [{ procedure_type_id: 1, name: 'CBC', has_fee: false }],
    } as never);
    render(<LabPanelModal {...baseProps()} />);
    expect(await screen.findByLabelText(/no fee mapped/)).toBeInTheDocument();
  });

  it('applies the starter panel', async () => {
    mockedFetch.mockResolvedValue({
      has_catalog: true,
      tests: [
        { procedure_type_id: 1, name: 'CBC', is_starter: true },
        { procedure_type_id: 2, name: 'Malaria RDT', is_starter: false },
      ],
    } as never);
    render(<LabPanelModal {...baseProps()} />);
    await screen.findByText('CBC');

    fireEvent.click(screen.getByRole('button', { name: 'Starter panel' }));
    expect(screen.getByLabelText(/CBC/)).toBeChecked();
    expect(screen.getByLabelText(/Malaria RDT/)).not.toBeChecked();
  });

  it('requires at least one selected test before placing', async () => {
    mockedFetch.mockResolvedValue({ has_catalog: true, tests: [{ procedure_type_id: 1, name: 'CBC' }] } as never);
    render(<LabPanelModal {...baseProps()} />);
    await screen.findByText('CBC');

    fireEvent.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Select at least one test.');
  });

  it('places the order and calls onPlaced on success', async () => {
    mockedFetch.mockResolvedValue({ has_catalog: true, tests: [{ procedure_type_id: 1, name: 'CBC' }] } as never);
    mockedPost.mockResolvedValue({ ok: true, data: {} } as never);

    const onPlaced = vi.fn();
    render(<LabPanelModal {...baseProps()} onPlaced={onPlaced} />);
    await screen.findByText('CBC');

    fireEvent.click(screen.getByLabelText(/CBC/));
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => expect(onPlaced).toHaveBeenCalledWith({}));
    expect(mockedPost).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'doctor.lab_panel_place', body: { visit_id: 7, procedure_type_ids: [1] } }),
    );
  });
});

describe('labPanelPlaceNotice', () => {
  it('reports posted charges when billing posted at least one charge', () => {
    const notice = labPanelPlaceNotice({ billing: { posted_count: 2, charges_total: 15 } } as never);
    expect(notice.variant).toBe('info');
    expect(notice.message).toContain('2 lab charge(s) posted');
  });

  it('nudges toward fee mapping when codes were unmapped', () => {
    const notice = labPanelPlaceNotice({ billing: { posted_count: 0, unmapped_codes: ['CBC'] } } as never);
    expect(notice.message).toBe('Lab order placed. Map fees in Lab Ops setup to auto-post charges.');
  });

  it('falls back to a plain success message otherwise', () => {
    const notice = labPanelPlaceNotice({} as never);
    expect(notice).toEqual({ message: 'Lab order placed for this visit.', variant: 'success' });
  });
});

describe('labReturnNotice', () => {
  it('returns null when the routing chips show no lab order', () => {
    expect(labReturnNotice(undefined)).toBeNull();
    expect(labReturnNotice({ lab_ordered: false } as never)).toBeNull();
  });

  it('warns when a lab order was saved with no test lines', () => {
    const notice = labReturnNotice({ lab_ordered: true, lab_order_incomplete: true } as never);
    expect(notice?.variant).toBe('warning');
  });

  it('confirms success when the lab order is complete', () => {
    const notice = labReturnNotice({ lab_ordered: true, lab_order_incomplete: false } as never);
    expect(notice?.variant).toBe('success');
  });
});
