import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PharmacyPrescriptionsTable } from './PharmacyPrescriptionsTable';

describe('PharmacyPrescriptionsTable', () => {
  it('shows stock badges when pharm ops enabled', () => {
    render(
      <PharmacyPrescriptionsTable
        prescriptions={[
          {
            id: 1,
            drug: 'Amoxicillin',
            sig: '500mg q8h',
            quantity: '21',
            status: 'to_dispense',
            stock_status: 'low',
            qoh_display: 'QOH 5 · reorder 20',
          },
        ]}
        showStockBadges
      />
    );

    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.getByText('QOH 5 · reorder 20')).toBeInTheDocument();
  });

  it('renders per-row dispense action', () => {
    const onDispense = vi.fn();
    render(
      <PharmacyPrescriptionsTable
        prescriptions={[
          {
            id: 42,
            drug: 'Paracetamol',
            sig: '1 tab',
            quantity: '30',
            status: 'to_dispense',
          },
        ]}
        canDispense
        onDispense={onDispense}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Dispense/i }));
    expect(onDispense).toHaveBeenCalledWith(42);
  });

  it('offers an Add Rx shortcut in the empty state instead of pointing at a stock screen', () => {
    // Regression guard (2026-07-14): this callout used to say "Doctor
    // creates Rx in core" with no way forward from the Pharmacy Desk itself
    // -- now that a native Add Rx page exists, the empty state should offer
    // it directly.
    const onAddRx = vi.fn();
    render(<PharmacyPrescriptionsTable prescriptions={[]} onAddRx={onAddRx} />);

    expect(screen.queryByText(/creates Rx in core/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Rx' }));
    expect(onAddRx).toHaveBeenCalled();
  });

  it('omits the Add Rx button when the desk is not ready to open it', () => {
    render(<PharmacyPrescriptionsTable prescriptions={[]} />);
    expect(screen.queryByRole('button', { name: 'Add Rx' })).not.toBeInTheDocument();
  });
});
