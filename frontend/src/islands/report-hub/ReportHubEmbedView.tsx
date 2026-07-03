import { DailyReports } from '@islands/daily-reports/DailyReports';
import { BillOpsHub } from '@islands/bill-ops/BillOpsHub';
import { PharmOpsReportsPane } from '@islands/pharm-ops/PharmOpsReportsPane';
import { PatientRegistry } from '@islands/patient-registry/PatientRegistry';
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
    <div className="oe-nc-reporthub-embed-panel mb-3">
      <div className="oe-nc-reporthub-embed-panel__head">
        <div>
          <h3 className="oe-nc-reporthub-embed-panel__title h6 mb-1">{title}</h3>
          {resolvedNote ? (
            <p className="oe-nc-reporthub-embed-panel__note small mb-0">{resolvedNote}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={onClose}
        >
          <i className="fa fa-times mr-1" aria-hidden="true" />
          Close
        </button>
      </div>

      {target.kind === 'stock_iframe' ? (
        <div className="alert alert-warning py-2 small mb-2" role="status">
          You are viewing a stock report inside the hub. Scheduling and encounter totals are orthogonal to visit queue counts.
        </div>
      ) : null}

      <div className="oe-nc-reporthub-embed-panel__body">
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
            canShowAdvanced={false}
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
          />
        ) : null}

        {target.kind === 'stock_iframe' ? (
          <iframe
            title={title}
            className="oe-nc-reporthub-embed oe-nc-reporthub-embed--stock"
            src={target.url}
          />
        ) : null}
      </div>
    </div>
  );
}
