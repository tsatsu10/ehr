import { oeFetch } from '@core/oeFetch';
import { ChartBanner } from '@islands/patient-chart/ChartBanner';
import { WidgetCard } from '@components/WidgetCard';
import { Button } from '@components/ui/button';
import type { ReactNode } from 'react';
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
  children: ReactNode;
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
    <div className={`nc-chart-depth-${mode}`}>
      <WidgetCard
        className="mb-3"
        bodyPad="pad"
        title={TITLES[mode]}
        headerClassName="flex justify-between items-center flex-wrap"
        actions={(
          <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
            <Button variant="outline" size="sm" asChild>
              <a href={chartUrl} target="_top">
                Back to chart
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
        <div id="nc-chart-depth-banner" className="mb-3">
          {preview && <ChartBanner preview={preview} />}
        </div>
        {children}
      </WidgetCard>
    </div>
  );
}
