import { ChargeCorrectionForm } from './ChargeCorrectionForm';

export interface CorrectionPageProps {
  ajaxUrl: string;
  csrfToken: string;
  visitId: number;
  billOpsUrl: string;
  visitBoardUrl: string;
}

export function CorrectionPage({
  ajaxUrl,
  csrfToken,
  visitId,
  billOpsUrl,
  visitBoardUrl,
}: CorrectionPageProps) {
  return (
    <div className="oe-nc-billops-correction-page">
      <div className="oe-nc-widget-card mb-3">
        <div className="oe-nc-widget-card__header d-flex justify-content-between align-items-center flex-wrap">
          <h2 className="oe-nc-widget-card__title mb-0">Charge correction</h2>
          <div className="btn-group btn-group-sm mt-2 mt-md-0">
            <a href={billOpsUrl} className="btn btn-outline-primary" target="_top">
              Billing back office
            </a>
            <a href={visitBoardUrl} className="btn btn-outline-secondary" target="_top">
              Visit Board
            </a>
          </div>
        </div>
        <div className="oe-nc-widget-card__body oe-nc-widget-card__body--pad">
          <ChargeCorrectionForm
            fetchOptions={{ ajaxUrl, csrfToken }}
            visitId={visitId}
            autoLoad
          />
        </div>
      </div>
    </div>
  );
}
