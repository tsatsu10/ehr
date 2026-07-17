import type { BillOpsHubProps } from './billOpsTypes';
import { PayerPricesPanel } from './PayerPricesPanel';
import { SchemeClaimsList } from './SchemeClaimsList';

interface InsurancePaneProps {
  ajaxUrl: string;
  csrfToken: string;
  canPayerBilling?: boolean;
}

export function InsurancePane({ ajaxUrl, csrfToken, canPayerBilling = false }: InsurancePaneProps) {
  return (
    <div className="nc-billops-pane">
      <SchemeClaimsList ajaxUrl={ajaxUrl} csrfToken={csrfToken} />
      {canPayerBilling && <PayerPricesPanel ajaxUrl={ajaxUrl} csrfToken={csrfToken} />}
    </div>
  );
}

export function InsurancePaneWrapper(props: BillOpsHubProps) {
  return (
    <InsurancePane
      ajaxUrl={props.ajaxUrl}
      csrfToken={props.csrfToken}
      canPayerBilling={props.canPayerBilling}
    />
  );
}
