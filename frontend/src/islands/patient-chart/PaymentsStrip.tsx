import { CreditCard, ExternalLink } from 'lucide-react';
import { Button } from '@components/ui/button';
import { ChartSection } from './chartUi';
import type { PaymentsStripData } from './patientChartTypes';

interface PaymentsStripProps {
  data: PaymentsStripData | null;
}

export function PaymentsStrip({ data }: PaymentsStripProps) {
  if (!data || data.hidden) return null;

  return (
    <ChartSection
      id="nc-profile-payments-strip-panel"
      title="Payments"
      description={data.payments_strip_label ?? 'Balance and recent receipts'}
      icon={<CreditCard className="h-4 w-4" aria-hidden />}
      variant={data.balance_warning ? 'alert' : 'default'}
      action={
        data.can_view_history && data.payment_history_url ? (
          <Button variant="outline" size="sm" asChild>
            <a href={data.payment_history_url} target="_top">
              View payment history
              <ExternalLink className="ml-1 h-4 w-4" aria-hidden />
            </a>
          </Button>
        ) : undefined
      }
    >
      {data.balance_due_amount != null && data.balance_due_amount > 0 && (
        <p className="mb-0 text-sm font-medium text-[var(--oe-nc-text)]">
          Balance due: {data.currency_symbol ?? ''}{data.balance_due_amount}
        </p>
      )}
      {data.last_receipt && (
        <p className="mb-0 mt-2 text-sm text-[var(--oe-nc-text-muted)]">
          Last receipt: #{data.last_receipt.receipt_number ?? '—'}
          {' · '}
          {data.currency_symbol ?? ''}
          {data.last_receipt.amount_paid ?? 0}
          {data.last_receipt.at ? ` · ${data.last_receipt.at}` : ''}
          {data.last_receipt.cashier ? ` · ${data.last_receipt.cashier}` : ''}
        </p>
      )}
    </ChartSection>
  );
}
