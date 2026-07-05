import { useEffect, useMemo, useState } from 'react';
import { CorrectionsPaneWrapper } from './CorrectionsPane';
import { PaymentsPaneWrapper } from './PaymentsPane';
import { CloseDayPaneWrapper } from './CloseDayPane';
import { OutstandingPaneWrapper } from './OutstandingPane';
import { InsurancePaneWrapper } from './InsurancePane';
import type { BillOpsHubProps, BillOpsTab } from './billOpsTypes';
import { allowedTabs, firstAllowedTab, useBillOpsPageHeading } from './useBillOpsPageHeading';
import { setBillOpsCurrencyFormat } from './billOpsFormatters';
import './main.css';

export function BillOpsHub(props: BillOpsHubProps) {
  useEffect(() => {
    if (props.currencyFormat) {
      setBillOpsCurrencyFormat({
        currency_symbol: props.currencyFormat.currency_symbol ?? 'GH₵',
        currency_decimals: props.currencyFormat.currency_decimals ?? 2,
        currency_symbol_position: props.currencyFormat.currency_symbol_position === 'after' ? 'after' : 'before',
      });
    }
  }, [props.currencyFormat]);

  const tabs = useMemo(() => allowedTabs(props), [props]);
  const [tab, setTab] = useState<BillOpsTab>(() => firstAllowedTab(props.initialTab, tabs));
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());

  useBillOpsPageHeading({
    tab,
    lastUpdated,
    onTabChange: setTab,
    onRefresh: () => setLastUpdated(new Date()),
  });

  return (
    <div className="nc-billops-hub">
      {tab === 'corrections' && props.canCorrect && <CorrectionsPaneWrapper {...props} />}
      {tab === 'payments' && props.canPayment && <PaymentsPaneWrapper {...props} />}
      {tab === 'close' && props.canClose && <CloseDayPaneWrapper {...props} />}
      {tab === 'outstanding' && props.canOutstanding && <OutstandingPaneWrapper {...props} />}
      {tab === 'insurance' && props.canInsurance && <InsurancePaneWrapper {...props} />}
    </div>
  );
}
