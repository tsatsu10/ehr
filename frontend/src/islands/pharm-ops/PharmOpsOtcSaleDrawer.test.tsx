import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { PharmOpsOtcSaleDrawer } from './PharmOpsOtcSaleDrawer';
import type { OtcSaleForm } from './pharmOpsTypes';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));
const mockedFetch = vi.mocked(oeFetch);

function saleForm(overrides: Partial<OtcSaleForm> = {}): OtcSaleForm {
  return {
    pid: 385,
    encounter_id: 385,
    patient: { display_name: 'Ama Owusu', mrn: 'P385' },
    visit: { visit_id: 5, queue_number: 5, visit_date: '2026-07-15' },
    drug: { drug_id: 2, drug_name: 'Paracetamol 500 mg', default_quantity: 1 },
    inventory: { on_hand: 500, can_fulfill: true },
    fee: { amount: 5, unit_amount: 5, currency_symbol: 'GH₵' },
    safety: { allergies: [], allergy_warning: false },
    encounter_required: false,
    encounter_warning: null,
    ...overrides,
  };
}

function mockRoutes(form: OtcSaleForm) {
  mockedFetch.mockImplementation((action: string) => {
    if (action === 'pharm_ops.otc_drugs_search') {
      return Promise.resolve({ rows: [{ drug_id: 2, drug_name: 'Paracetamol 500 mg', on_hand: 500 }] }) as never;
    }
    if (action === 'pharm_ops.otc_sale_get') {
      return Promise.resolve(form) as never;
    }
    if (action === 'pharm_ops.otc_sale_confirm') {
      return Promise.resolve({ sale_id: 1, drug_name: 'Paracetamol 500 mg', quantity: 20 }) as never;
    }
    return Promise.resolve({}) as never;
  });
}

const baseProps = {
  open: true,
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  canDispense: true,
  initialContext: { pid: 385, patientLabel: 'Ama Owusu', encounterId: 385 },
  onClose: vi.fn(),
  onSold: vi.fn(),
};

const feeInput = () => document.getElementById('nc-pharmops-otc-fee') as HTMLInputElement;
const qtyInput = () => document.getElementById('nc-pharmops-otc-qty') as HTMLInputElement;

async function selectDrugAndLoadForm() {
  fireEvent.change(document.getElementById('nc-pharmops-otc-drug') as HTMLElement, {
    target: { value: 'para' },
  });
  const option = await screen.findByRole('button', { name: /Paracetamol 500 mg/i });
  fireEvent.click(option);
  await waitFor(() => expect(qtyInput()).toBeInTheDocument());
}

beforeEach(() => mockedFetch.mockReset());

describe('PharmOpsOtcSaleDrawer', () => {
  it('scales the fee with quantity (unit price x qty) until manually overridden', async () => {
    mockRoutes(saleForm());
    render(<PharmOpsOtcSaleDrawer {...baseProps} />);
    await selectDrugAndLoadForm();

    // Prefill = unit price x default qty (5 x 1).
    expect(feeInput().value).toBe('5');

    // Qty 20 -> fee 100.
    fireEvent.change(qtyInput(), { target: { value: '20' } });
    await waitFor(() => expect(feeInput().value).toBe('100'));

    // Manual override wins and is no longer auto-recomputed.
    fireEvent.change(feeInput(), { target: { value: '90' } });
    fireEvent.change(qtyInput(), { target: { value: '10' } });
    await waitFor(() => expect(qtyInput().value).toBe('10'));
    expect(feeInput().value).toBe('90');
  });

  it('blocks the sale on a zero fee or overselling stock', async () => {
    mockRoutes(saleForm({ inventory: { on_hand: 8, can_fulfill: true } }));
    render(<PharmOpsOtcSaleDrawer {...baseProps} />);
    await selectDrugAndLoadForm();

    const confirm = () => screen.getByRole('button', { name: 'Confirm sale' });
    expect(confirm()).toBeEnabled();

    // Over stock -> warning + blocked.
    fireEvent.change(qtyInput(), { target: { value: '20' } });
    await waitFor(() => expect(screen.getByText('Only 8 in stock.')).toBeInTheDocument());
    expect(confirm()).toBeDisabled();

    // Back within stock, but a blank fee also blocks.
    fireEvent.change(qtyInput(), { target: { value: '2' } });
    fireEvent.change(feeInput(), { target: { value: '' } });
    await waitFor(() => expect(confirm()).toBeDisabled());
  });
});
