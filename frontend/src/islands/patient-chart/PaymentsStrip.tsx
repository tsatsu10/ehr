import { Button } from '@components/ui/button';
import type { PaymentsStripData } from './patientChartTypes';

interface PaymentsStripProps {
  data: PaymentsStripData | null;
}

export function PaymentsStrip({ data }: PaymentsStripProps) {
  if (!data || data.hidden) return null;

  return (
    <section
      className={`border rounded p-3 mb-3${data.balance_warning ? ' border-warning bg-[var(--oe-nc-bg-tint)]' : ''}`}
      id="nc-profile-payments-strip-panel"
    >
      <div className="flex flex-wrap justify-between items-start">
        <div className="flex-grow mb-2 md:mb-0">
          <h5 className="mb-1">Payments</h5>
          <div className="text-sm">{data.payments_strip_label ?? ''}</div>
        </div>
        {data.can_view_history && data.payment_history_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={data.payment_history_url} target="_top">
              View payment history
            </a>
          </Button>
        )}
      </div>
    </section>
  );
}
