import { render, screen } from '@testing-library/react';
import { PaymentsStrip } from './PaymentsStrip';

describe('PaymentsStrip', () => {
  it('renders nothing when hidden', () => {
    const { container } = render(<PaymentsStrip data={{ hidden: true }} />);
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * Regression guard (2026-07-11 A4 smoke finding): last_receipt is an OBJECT
   * from ProfilePaymentsSummaryService, but the old code rendered it directly
   * as a React child ("Last receipt: {data.last_receipt}") — React error #31,
   * crashing the entire patient chart island for any patient with a receipt
   * when chart-depth finance is enabled.
   */
  it('renders the last receipt object as readable fields, not a raw child', () => {
    render(
      <PaymentsStrip
        data={{
          hidden: false,
          balance_due_amount: 20,
          balance_warning: true,
          currency_symbol: 'GH₵',
          last_receipt: {
            id: 7,
            receipt_number: 'R-0007',
            amount_paid: 45,
            at: '11/07/2026',
            cashier: 'Kofi Cashier',
            visit_id: 9,
          },
        }}
      />
    );

    expect(screen.getByText(/Last receipt: #R-0007/)).toBeInTheDocument();
    expect(screen.getByText(/GH₵45/)).toBeInTheDocument();
    expect(screen.getByText(/Kofi Cashier/)).toBeInTheDocument();
  });
});
