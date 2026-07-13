import { ChartDepthShell } from './ChartDepthShell';
import { ExportPane } from './ExportPane';
import { LettersPanel } from './LettersPanel';
import { PaymentsPane } from './PaymentsPane';
import { ReferralsPane } from './ReferralsPane';
import { SegmentedControl } from '@components/SegmentedControl';
import type { ChartDepthProps } from './chartDepthTypes';
import { useEffect, useState } from 'react';
import { setChartDepthCurrencyFormat } from './chartDepthUtils';

export function ChartDepthPage({
  mode,
  ajaxUrl,
  csrfToken,
  pid,
  visitId,
  encounterId,
  preset,
  enableReferrals = true,
  enableLetters,
  initialView,
  letterPrintUrl,
  chartUrl,
  visitBoardUrl,
  currencyFormat,
}: ChartDepthProps) {
  const [referralsView, setReferralsView] = useState<'referrals' | 'letters'>(
    initialView === 'letters' || !enableReferrals ? 'letters' : 'referrals'
  );
  useEffect(() => {
    if (currencyFormat) {
      setChartDepthCurrencyFormat({
        currency_symbol: currencyFormat.currency_symbol ?? '',
        currency_decimals: currencyFormat.currency_decimals ?? 2,
        currency_symbol_position: currencyFormat.currency_symbol_position === 'after' ? 'after' : 'before',
      });
    }
  }, [currencyFormat]);
  return (
    <ChartDepthShell
      mode={mode}
      ajaxUrl={ajaxUrl}
      csrfToken={csrfToken}
      pid={pid}
      chartUrl={chartUrl}
      visitBoardUrl={visitBoardUrl}
    >
      {mode === 'payments' && (
        <PaymentsPane ajaxUrl={ajaxUrl} csrfToken={csrfToken} pid={pid} visitId={visitId} />
      )}
      {mode === 'referrals' && (
        <>
          {enableReferrals && enableLetters && (
            <div className="mb-3">
              <SegmentedControl
                ariaLabel="Referrals hub view"
                segments={[
                  { id: 'referrals', label: 'Referrals' },
                  { id: 'letters', label: 'Letters' },
                ]}
                value={referralsView}
                onChange={(id) => setReferralsView(id === 'letters' ? 'letters' : 'referrals')}
              />
            </div>
          )}
          {enableLetters && (!enableReferrals || referralsView === 'letters') ? (
            <LettersPanel
              ajaxUrl={ajaxUrl}
              csrfToken={csrfToken}
              pid={pid}
              letterPrintUrl={letterPrintUrl ?? ''}
            />
          ) : (
            <ReferralsPane
              ajaxUrl={ajaxUrl}
              csrfToken={csrfToken}
              pid={pid}
              encounterId={encounterId}
            />
          )}
        </>
      )}
      {mode === 'export' && (
        <ExportPane
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          pid={pid}
          initialPreset={preset}
          initialEncounterId={encounterId}
        />
      )}
    </ChartDepthShell>
  );
}
