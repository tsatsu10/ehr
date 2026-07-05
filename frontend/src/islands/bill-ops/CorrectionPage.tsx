import { useEffect } from 'react';
import { WidgetCard } from '@components/WidgetCard';
import { Button } from '@components/ui/button';
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
    <div className="nc-billops-correction-page">
      <WidgetCard
        className="mb-3"
        bodyPad="pad"
        title="Charge correction"
        headerClassName="nc-flex nc-justify-between nc-items-center nc-flex-wrap"
        actions={(
          <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
            <Button variant="outline" size="sm" asChild>
              <a href={billOpsUrl} target="_top">
                Billing back office
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={visitBoardUrl} target="_top">
                Visit Board
              </a>
            </Button>
          </div>
        )}
      >
        <ChargeCorrectionForm
          fetchOptions={{ ajaxUrl, csrfToken }}
          visitId={visitId}
          autoLoad
        />
      </WidgetCard>
    </div>
  );
}
