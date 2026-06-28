import type { PaymentsStripData } from './patientChartTypes';

interface PaymentsStripProps {
  data: PaymentsStripData | null;
}

export function PaymentsStrip({ data }: PaymentsStripProps) {
  if (!data || data.hidden) return null;

  return (
    <section
      className={`border rounded p-3 mb-3${data.balance_warning ? ' border-warning bg-light' : ''}`}
      id="nc-profile-payments-strip-panel"
    >
      <div className="d-flex flex-wrap justify-content-between align-items-start">
        <div className="flex-grow-1 mb-2 mb-md-0">
          <h5 className="mb-1">Payments</h5>
          <div className="small">{data.payments_strip_label ?? ''}</div>
        </div>
        {data.can_view_history && data.payment_history_url && (
          <a className="btn btn-sm btn-outline-primary" href={data.payment_history_url} target="_top">
            View payment history
          </a>
        )}
      </div>
    </section>
  );
}
