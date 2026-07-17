import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PharmacyShortcuts } from './PharmacyShortcuts';

function baseProps() {
  return {
    blocked: false,
    inPharmacy: true,
    onDispense: vi.fn(),
    onAddRx: vi.fn(),
  };
}

describe('PharmacyShortcuts', () => {
  it('disables Dispense and Print Rx with a helpful title when there is nothing to act on yet', () => {
    // Regression guard (2026-07-14): with zero prescriptions on the visit,
    // Dispense used to silently fall back to a stock encounter page and
    // Print Rx did nothing at all when clicked -- both are now disabled
    // with an explanation instead.
    render(
      <PharmacyShortcuts
        {...baseProps()}
        canPrintRx
        hasDispensable={false}
        hasPrintable={false}
        onPrintRx={vi.fn()}
      />,
    );

    const dispenseBtn = screen.getByRole('button', { name: 'Dispense' });
    expect(dispenseBtn).toBeDisabled();
    expect(dispenseBtn).toHaveAttribute('title', expect.stringContaining('add a prescription first'));

    const printBtn = screen.getByRole('button', { name: 'Print Rx' });
    expect(printBtn).toBeDisabled();
    expect(printBtn).toHaveAttribute('title', expect.stringContaining('add one first'));

    // Add Rx must stay enabled -- it's the way out of this exact state.
    expect(screen.getByRole('button', { name: 'Add Rx' })).toBeEnabled();
  });

  it('keeps Dispense and Print Rx enabled by default (existing desks that do not pass the new props)', () => {
    render(<PharmacyShortcuts {...baseProps()} canPrintRx onPrintRx={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Dispense' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Print Rx' })).toBeEnabled();
  });

  it('enables Dispense when there is a to-dispense line even with Print disabled independently', () => {
    render(
      <PharmacyShortcuts
        {...baseProps()}
        canPrintRx
        hasDispensable
        hasPrintable={false}
        onPrintRx={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Dispense' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Print Rx' })).toBeDisabled();
  });
});
