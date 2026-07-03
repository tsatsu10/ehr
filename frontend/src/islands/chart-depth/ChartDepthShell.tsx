import { oeFetch } from '@core/oeFetch';
import { ChartBanner } from '@islands/patient-chart/ChartBanner';
import { WidgetCard } from '@components/WidgetCard';
import type { ChartDepthMode, ChartPreview } from './chartDepthTypes';
import { useEffect, useMemo, useState } from 'react';

const TITLES: Record<ChartDepthMode, string> = {
  payments: 'Payment history',
  referrals: 'Referrals',
  export: 'Export chart',
};

interface ChartDepthShellProps {
  mode: ChartDepthMode;
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  chartUrl: string;
  visitBoardUrl: string;
  children: React.ReactNode;
}

export function ChartDepthShell({
  mode,
  ajaxUrl,
  csrfToken,
  pid,
  chartUrl,
  visitBoardUrl,
  children,
}: ChartDepthShellProps) {
  const [preview, setPreview] = useState<ChartPreview | null>(null);
  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  useEffect(() => {
    void oeFetch<ChartPreview>('patients.preview', {
      ...fetchOptions,
      method: 'POST',
      json: { pid, context: 'chart-depth' },
    })
      .then(setPreview)
      .catch(() => {
        /* banner optional */
      });
  }, [fetchOptions, pid]);

  return (
    <div className={`oe-nc-chart-depth-${mode}`}>
      <WidgetCard
        className="mb-3"
        bodyPad="pad"
        title={<h2 className="oe-nc-widget-card__title mb-0">{TITLES[mode]}</h2>}
        headerClassName="d-flex justify-content-between align-items-center flex-wrap"
        actions={(
          <div className="btn-group btn-group-sm mt-2 mt-md-0">
            <a href={chartUrl} className="btn btn-outline-primary" target="_top">
              Back to chart
            </a>
            <a href={visitBoardUrl} className="btn btn-outline-secondary" target="_top">
              Visit Board
            </a>
          </div>
        )}
      >
        <div id="nc-chart-depth-banner" className="mb-3">
          {preview && <ChartBanner preview={preview} />}
        </div>
        {children}
      </WidgetCard>
    </div>
  );
}
