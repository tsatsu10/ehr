import { useMemo, useState } from 'react';
import { CorrectionsPaneWrapper } from './CorrectionsPane';
import { PaymentsPaneWrapper } from './PaymentsPane';
import { CloseDayPaneWrapper } from './CloseDayPane';
import { OutstandingPaneWrapper } from './OutstandingPane';
import { InsurancePaneWrapper } from './InsurancePane';
import type { BillOpsHubProps, BillOpsTab } from './billOpsTypes';
import { allowedTabs, firstAllowedTab, useBillOpsPageHeading } from './useBillOpsPageHeading';
import './main.css';

export function BillOpsHub(props: BillOpsHubProps) {
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
    <div className="oe-nc-billops-hub">
      {tab === 'corrections' && props.canCorrect && <CorrectionsPaneWrapper {...props} />}
      {tab === 'payments' && props.canPayment && <PaymentsPaneWrapper {...props} />}
      {tab === 'close' && props.canClose && <CloseDayPaneWrapper {...props} />}
      {tab === 'outstanding' && props.canOutstanding && <OutstandingPaneWrapper {...props} />}
      {tab === 'insurance' && props.canInsurance && <InsurancePaneWrapper {...props} />}
    </div>
  );
}
