import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { PharmOpsReceiveDrawer } from './PharmOpsReceiveDrawer';
import type { ReceiveForm } from './pharmOpsTypes';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));
const mockedFetch = vi.mocked(oeFetch);

function receiveForm(overrides: Partial<ReceiveForm> = {}): ReceiveForm {
  return {
    warehouses: [{ id: 'onsite', title: 'On Site' }],
    default_warehouse_id: 'onsite',
    currency_symbol: 'GH₵',
    drug: { drug_id: 2, drug_name: 'Amoxicillin 500 mg', on_hand: 60 },
    vendors: [{ id: 5, display_name: 'Ernest Chemists' }],
    can_receive: true,
    ...overrides,
  };
}

const baseProps = {
  open: true,
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  canReceive: true,
  initialContext: { drugId: 2, drugName: 'Amoxicillin 500 mg' },
  onClose: vi.fn(),
  onReceived: vi.fn(),
};

async function fillRequiredFields() {
  fireEvent.change(document.getElementById('nc-pharmops-receive-lot') as HTMLElement, { target: { value: 'LOT-1' } });
  fireEvent.change(document.getElementById('nc-pharmops-receive-exp') as HTMLElement, { target: { value: '2028-01-01' } });
}

beforeEach(() => mockedFetch.mockReset());

describe('PharmOpsReceiveDrawer supplier picker (INV-7)', () => {
  it('sends the selected existing vendor_id on confirm', async () => {
    mockedFetch.mockImplementation((action: string) => {
      if (action === 'pharm_ops.receive_get') return Promise.resolve(receiveForm()) as never;
      if (action === 'pharm_ops.receive_save') {
        return Promise.resolve({ sale_id: 1, inventory_id: 1, drug_id: 2, lot_number: 'LOT-1', quantity: 10, on_hand: 70 }) as never;
      }
      return Promise.resolve({}) as never;
    });

    render(<PharmOpsReceiveDrawer {...baseProps} />);
    await waitFor(() => expect(document.getElementById('nc-pharmops-receive-vendor')).toBeInTheDocument());
    await fillRequiredFields();

    fireEvent.change(document.getElementById('nc-pharmops-receive-vendor') as HTMLElement, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm receive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));

    await waitFor(() => {
      const saveCall = mockedFetch.mock.calls.find((c) => c[0] === 'pharm_ops.receive_save');
      expect(saveCall?.[1]?.json).toMatchObject({ vendor_id: 5 });
      expect(saveCall?.[1]?.json).not.toHaveProperty('new_vendor_name');
    });
  });

  it('switches to "add new supplier" and sends new_vendor_name instead', async () => {
    mockedFetch.mockImplementation((action: string) => {
      if (action === 'pharm_ops.receive_get') return Promise.resolve(receiveForm()) as never;
      if (action === 'pharm_ops.receive_save') {
        return Promise.resolve({ sale_id: 1, inventory_id: 1, drug_id: 2, lot_number: 'LOT-1', quantity: 10, on_hand: 70 }) as never;
      }
      return Promise.resolve({}) as never;
    });

    render(<PharmOpsReceiveDrawer {...baseProps} />);
    await waitFor(() => expect(document.getElementById('nc-pharmops-receive-vendor')).toBeInTheDocument());
    await fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: '+ New supplier' }));
    const nameInput = document.getElementById('nc-pharmops-receive-vendor-new') as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();

    // Blank new-supplier name blocks the confirm button.
    expect(screen.getByRole('button', { name: 'Confirm receive' })).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: 'New Pharma Distributors' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm receive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));

    await waitFor(() => {
      const saveCall = mockedFetch.mock.calls.find((c) => c[0] === 'pharm_ops.receive_save');
      expect(saveCall?.[1]?.json).toMatchObject({ new_vendor_name: 'New Pharma Distributors' });
      expect(saveCall?.[1]?.json).not.toHaveProperty('vendor_id');
    });
  });

  it('receives with no supplier when none is picked', async () => {
    mockedFetch.mockImplementation((action: string) => {
      if (action === 'pharm_ops.receive_get') return Promise.resolve(receiveForm()) as never;
      if (action === 'pharm_ops.receive_save') {
        return Promise.resolve({ sale_id: 1, inventory_id: 1, drug_id: 2, lot_number: 'LOT-1', quantity: 10, on_hand: 70 }) as never;
      }
      return Promise.resolve({}) as never;
    });

    render(<PharmOpsReceiveDrawer {...baseProps} />);
    await waitFor(() => expect(document.getElementById('nc-pharmops-receive-vendor')).toBeInTheDocument());
    await fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm receive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));

    await waitFor(() => {
      const saveCall = mockedFetch.mock.calls.find((c) => c[0] === 'pharm_ops.receive_save');
      expect(saveCall?.[1]?.json).not.toHaveProperty('vendor_id');
      expect(saveCall?.[1]?.json).not.toHaveProperty('new_vendor_name');
    });
  });
});

describe('PharmOpsReceiveDrawer lot number length guard', () => {
  it('caps the lot number input at 20 chars (matches the DB column, which silently truncates otherwise)', async () => {
    mockedFetch.mockImplementation((action: string) => {
      if (action === 'pharm_ops.receive_get') return Promise.resolve(receiveForm()) as never;
      return Promise.resolve({}) as never;
    });

    render(<PharmOpsReceiveDrawer {...baseProps} />);
    await waitFor(() => expect(document.getElementById('nc-pharmops-receive-lot')).toBeInTheDocument());

    expect(document.getElementById('nc-pharmops-receive-lot')).toHaveAttribute('maxLength', '20');
  });
});
