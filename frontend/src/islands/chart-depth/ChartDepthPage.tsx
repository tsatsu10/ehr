import { ChartDepthShell } from './ChartDepthShell';
import { ExportPane } from './ExportPane';
import { PaymentsPane } from './PaymentsPane';
import { ReferralsPane } from './ReferralsPane';
import type { ChartDepthProps } from './chartDepthTypes';

export function ChartDepthPage({
  mode,
  ajaxUrl,
  csrfToken,
  pid,
  visitId,
  encounterId,
  preset,
  chartUrl,
  visitBoardUrl,
}: ChartDepthProps) {
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
        <ReferralsPane
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          pid={pid}
          encounterId={encounterId}
        />
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
