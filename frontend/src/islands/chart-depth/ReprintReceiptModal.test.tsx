import { render, screen } from '@testing-library/react';
import { ReprintReceiptModal } from './ReprintReceiptModal';
import type { ReceiptReprintPayload } from './chartDepthTypes';

const basePayload: ReceiptReprintPayload = {
  receipt: {
    receipt_number: 'R-0007',
    queue_number: 4,
    amount_paid: 45,
    change_due: 0,
    paid_at_label: '27/06/2026 10:15',
  },
  patient: { display_name: 'Ama Boateng', pubpid: 'MRN003' },
};

describe('ReprintReceiptModal', () => {
  it('shows the queue number by default (older payloads without the flag)', () => {
    render(<ReprintReceiptModal open payload={basePayload} onClose={() => {}} />);
    expect(screen.getByText(/Queue #4/)).toBeInTheDocument();
  });

  /**
   * Regression guard (2026-07-11 audit): print_queue_number_on_receipt was an
   * Admin Hub toggle wired to nothing. Reprints (chart-depth and bill-ops share
   * this modal) must honor it the same way the live cashier receipt does.
   */
  it('hides the queue number when show_queue_number is false', () => {
    render(
      <ReprintReceiptModal
        open
        payload={{
          ...basePayload,
          receipt: { ...basePayload.receipt, show_queue_number: false },
        }}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText(/Queue #/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/R-0007/).length).toBeGreaterThan(0);
  });
});
