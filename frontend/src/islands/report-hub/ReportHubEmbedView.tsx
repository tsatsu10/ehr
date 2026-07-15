import { DailyReports } from '@islands/daily-reports/DailyReports';
import { BillOpsHub } from '@islands/bill-ops/BillOpsHub';
import { PharmOpsReportsPane } from '@islands/pharm-ops/PharmOpsReportsPane';
import { PatientRegistry } from '@islands/patient-registry/PatientRegistry';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import type { ReportHubEmbedContext } from './reportHubTypes';
import type { ReportHubEmbedTarget } from './reportHubEmbed';

interface ReportHubEmbedViewProps {
  title: string;
  target: ReportHubEmbedTarget;
  note?: string;
  onClose: () => void;
  context: ReportHubEmbedContext;
}

function embedNote(target: ReportHubEmbedTarget): string | undefined {
  if (target.kind === 'stock_iframe') {
    return 'Legacy OpenEMR report — counts may differ from M7 module queue metrics.';
  }
  if (target.kind === 'daily_reports' && target.initialTab === 'scheduling') {
    return 'Scheduling funnel — do not sum with M7 visit throughput.';
  }
  return undefined;
}

export function ReportHubEmbedView({
  title,
  target,
  note,
  onClose,
  context,
}: ReportHubEmbedViewProps) {
  const resolvedNote = note ?? embedNote(target);

  return (
    <div className="nc-reporthub-embed-panel mb-3">
      <div className="nc-reporthub-embed-panel-head">
        <div>
          <h3 className="nc-reporthub-embed-panel-title text-base font-semibold mb-1">{title}</h3>
          {resolvedNote ? (
            <p className="nc-reporthub-embed-panel-note text-sm mb-0">{resolvedNote}</p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <i className="fa fa-times mr-1" aria-hidden="true" />
          Close
        </Button>
      </div>

      {target.kind === 'stock_iframe' ? (
        <div className={deskCalloutClass('warn', 'py-2 text-sm mb-2')} role="status">
          You are viewing a stock report inside the hub. Scheduling and encounter totals are orthogonal to visit queue counts.
        </div>
      ) : null}

      <div className="nc-reporthub-embed-panel-body">
        {target.kind === 'daily_reports' ? (
          <DailyReports
            ajaxUrl={context.ajaxUrl}
            csrfToken={context.csrfToken}
            facilityId={context.facilityId}
            visitBoardUrl={context.visitBoardUrl}
            canCancelVisit={context.canCancelVisit}
            canMarkUnpaid={context.canMarkUnpaid}
            canRunReconciliation={context.canRunReconciliation}
            scheduledIntegrationEnabled={context.scheduledIntegrationEnabled}
            syncUrl={false}
            initialVisitDate={context.visitDate}
            initialTab={target.initialTab}
          />
        ) : null}

        {target.kind === 'bill_ops' ? (
          <BillOpsHub
            ajaxUrl={context.ajaxUrl}
            csrfToken={context.csrfToken}
            moduleUrl={context.moduleUrl}
            cashierUrl={context.cashierUrl}
            reportsUrl={context.reportsUrl}
            visitBoardUrl={context.visitBoardUrl}
            facilityId={context.facilityId}
            initialTab={target.initialTab}
            canCorrect={context.billOps.canCorrect}
            canPayment={context.billOps.canPayment}
            canClose={context.billOps.canClose}
            canOutstanding={context.billOps.canOutstanding}
            canInsurance={context.billOps.canInsurance}
            canEdiHistory={context.billOps.canEdiHistory}
            reopenOnCorrection={context.billOps.reopenOnCorrection}
            webroot={context.webroot}
            currencyFormat={context.currencyFormat}
          />
        ) : null}

        {target.kind === 'pharm_ops_reports' ? (
          <PharmOpsReportsPane
            ajaxUrl={context.ajaxUrl}
            csrfToken={context.csrfToken}
          />
        ) : null}

        {target.kind === 'patient_registry' ? (
          <PatientRegistry
            ajaxUrl={context.ajaxUrl}
            csrfToken={context.csrfToken}
            chartUrlBase={context.chartUrlBase}
            billingThreshold={context.billingThreshold}
            visitBoardUrl={context.visitBoardUrl}
            frontDeskUrl={context.frontDeskUrl}
            moduleUrl={context.moduleUrl}
            facilityId={context.facilityId}
            scheduledIntegrationEnabled={context.scheduledIntegrationEnabled}
            canStartVisit={context.canStartVisit}
          />
        ) : null}

        {target.kind === 'stock_iframe' ? (
          <div className="nc-reporthub-stock-external">
            <i className="fa fa-file-text nc-reporthub-stock-external-icon" aria-hidden="true" />
            <p className="nc-reporthub-stock-external-msg">
              This is a legacy OpenEMR report and cannot be embedded here.
              It will open in a new browser tab.
            </p>
            <Button asChild>
              <a href={target.url} target="_blank" rel="noopener noreferrer">
                <i className="fa fa-external-link mr-1" aria-hidden="true" />
                Open report
              </a>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
