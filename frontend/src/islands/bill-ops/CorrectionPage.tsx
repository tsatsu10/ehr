import { useEffect } from 'react';
import { ChargeCorrectionForm } from './ChargeCorrectionForm';
import { setBillOpsCurrencyFormat } from './billOpsFormatters';

export interface CorrectionPageProps {
  ajaxUrl: string;
  csrfToken: string;
  visitId: number;
  billOpsUrl: string;
  visitBoardUrl: string;
  currencyFormat?: {
    currency_symbol?: string;
    currency_decimals?: number;
    currency_symbol_position?: 'before' | 'after';
  };
}

export function CorrectionPage({
  ajaxUrl,
  csrfToken,
  visitId,
  billOpsUrl,
  visitBoardUrl,
  currencyFormat,
}: CorrectionPageProps) {
  useEffect(() => {
    if (currencyFormat) {
      setBillOpsCurrencyFormat({
        currency_symbol: currencyFormat.currency_symbol ?? 'GH₵',
        currency_decimals: currencyFormat.currency_decimals ?? 2,
        currency_symbol_position: currencyFormat.currency_symbol_position === 'after' ? 'after' : 'before',
      });
    }
  }, [currencyFormat]);
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
