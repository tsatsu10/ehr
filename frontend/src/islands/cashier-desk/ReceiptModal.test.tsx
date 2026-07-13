import { render, screen } from '@testing-library/react';
import { ReceiptModal } from './ReceiptModal';
import type { CashierReceipt, PatientPreview } from '@core/types';

const preview: PatientPreview = {
  identity: { pid: 3, pubpid: 'MRN003', display_name: 'Ama Boateng', sex: 'F', age_years: '28' },
  completion: { score: 90, billing_threshold: 70 },
} as PatientPreview;

const baseReceipt: CashierReceipt = {
  queue_number: '4',
  amount_paid: 45,
  change_due: 0,
  receipt_number: 'R-0007',
};

describe('ReceiptModal', () => {
  it('shows the queue number by default (older payloads without the flag)', () => {
    render(<ReceiptModal open preview={preview} receipt={baseReceipt} onClose={() => {}} />);
    expect(screen.getByText(/Queue #4/)).toBeInTheDocument();
  });

  it('shows the queue number when show_queue_number is true', () => {
    render(
      <ReceiptModal
        open
        preview={preview}
        receipt={{ ...baseReceipt, show_queue_number: true }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/Queue #4/)).toBeInTheDocument();
  });

  /**
   * Regression guard (2026-07-11 audit): print_queue_number_on_receipt was an
   * Admin Hub toggle wired to nothing -- the receipt always printed the queue
   * number. The backend now sends show_queue_number from that setting.
   */
  it('hides the queue number when show_queue_number is false', () => {
    render(
      <ReceiptModal
        open
        preview={preview}
        receipt={{ ...baseReceipt, show_queue_number: false }}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText(/Queue #/)).not.toBeInTheDocument();
    expect(screen.getByText(/Receipt #R-0007/)).toBeInTheDocument();
  });
});
