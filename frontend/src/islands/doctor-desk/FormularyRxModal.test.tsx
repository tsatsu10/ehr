import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { postDoctorAction } from './postDoctorAction';
import { FormularyRxModal } from './FormularyRxModal';
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
    onFullRxForm: vi.fn(),
  };
}

describe('FormularyRxModal', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedPost.mockReset();
  });

  it('renders nothing without a visit', () => {
    const { container } = render(<FormularyRxModal {...baseProps()} visit={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('loads the catalog and lists drugs with dosage and fee', async () => {
    mockedFetch.mockResolvedValue({
      has_catalog: true,
      drugs: [{ drug_id: 1, name: 'Paracetamol', dosage: '500mg', quantity: '10', has_fee: true, fee_amount: 5, is_starter: true }],
    } as never);

    render(<FormularyRxModal {...baseProps()} />);

    expect(await screen.findByText(/Paracetamol/)).toBeInTheDocument();
    expect(screen.getByText(/500mg/)).toBeInTheDocument();
  });

  it('warns when the catalog is not ready and disables Add prescriptions', async () => {
    mockedFetch.mockResolvedValue({ has_catalog: false, drugs: [] } as never);
    render(<FormularyRxModal {...baseProps()} />);

    expect(await screen.findByText(/Formulary is not ready/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add prescriptions' })).toBeDisabled();
  });

  it('applies the starter pack, selecting only starter drugs', async () => {
    mockedFetch.mockResolvedValue({
      has_catalog: true,
      drugs: [
        { drug_id: 1, name: 'Paracetamol', is_starter: true },
        { drug_id: 2, name: 'Amoxicillin', is_starter: false },
      ],
    } as never);

    render(<FormularyRxModal {...baseProps()} />);
    await screen.findByText('Paracetamol');

    fireEvent.click(screen.getByRole('button', { name: 'Starter pack' }));

    expect(screen.getByLabelText(/Paracetamol/)).toBeChecked();
    expect(screen.getByLabelText(/Amoxicillin/)).not.toBeChecked();
  });

  it('sums the estimated fee only for selected drugs with a fee', async () => {
    mockedFetch.mockResolvedValue({
      has_catalog: true,
      drugs: [
        { drug_id: 1, name: 'Paracetamol', has_fee: true, fee_amount: 5 },
        { drug_id: 2, name: 'Amoxicillin', has_fee: true, fee_amount: 12 },
      ],
    } as never);

    render(<FormularyRxModal {...baseProps()} />);
    await screen.findByText('Paracetamol');

    fireEvent.click(screen.getByLabelText(/Paracetamol/));
    expect(screen.getByText(/Est\. unit fees:/)).toHaveTextContent('5');

    fireEvent.click(screen.getByLabelText(/Amoxicillin/));
    expect(screen.getByText(/Est\. unit fees:/)).toHaveTextContent('17');
  });

  it('requires at least one selected medication before placing', async () => {
    mockedFetch.mockResolvedValue({
      has_catalog: true,
      drugs: [{ drug_id: 1, name: 'Paracetamol' }],
    } as never);

    render(<FormularyRxModal {...baseProps()} />);
    await screen.findByText('Paracetamol');

    fireEvent.click(screen.getByRole('button', { name: 'Add prescriptions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Select at least one medication.');
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('places the prescriptions and calls onPlaced on success', async () => {
    mockedFetch.mockResolvedValue({
      has_catalog: true,
      drugs: [{ drug_id: 1, name: 'Paracetamol' }],
    } as never);
    mockedPost.mockResolvedValue({ ok: true, data: { prescription_count: 1 } } as never);

    const onPlaced = vi.fn();
    render(<FormularyRxModal {...baseProps()} onPlaced={onPlaced} />);
    await screen.findByText('Paracetamol');

    fireEvent.click(screen.getByLabelText(/Paracetamol/));
    fireEvent.click(screen.getByRole('button', { name: 'Add prescriptions' }));

    await waitFor(() => {
      expect(onPlaced).toHaveBeenCalledWith({ prescription_count: 1 });
    });
    expect(mockedPost).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'doctor.formulary_rx_place', body: { visit_id: 7, drug_ids: [1] } }),
    );
  });

  it('opens the full Rx form via the escape hatch', async () => {
    mockedFetch.mockResolvedValue({ has_catalog: false, drugs: [] } as never);
    const onFullRxForm = vi.fn();
    render(<FormularyRxModal {...baseProps()} onFullRxForm={onFullRxForm} />);
    await screen.findByText(/Formulary is not ready/);

    fireEvent.click(screen.getByRole('button', { name: 'Full Rx form' }));
    expect(onFullRxForm).toHaveBeenCalled();
  });
});
