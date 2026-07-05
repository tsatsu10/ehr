import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { NativeSelect } from '@components/ui/native-select';
import type { PharmOpsReportCatalog, PharmOpsReportItem } from './pharmOpsTypes';

interface PharmOpsReportsPaneProps {
  ajaxUrl: string;
  csrfToken: string;
}

export function PharmOpsReportsPane({ ajaxUrl, csrfToken }: PharmOpsReportsPaneProps) {
  const [catalog, setCatalog] = useState<PharmOpsReportCatalog | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const loadCatalog = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await oeFetch<PharmOpsReportCatalog>('pharm_ops.reports_embed', fetchOptions);
      setCatalog(data);
      const defaultId = data.default_report_id
        ?? data.reports?.[0]?.id
        ?? '';
      setSelectedId((current) => current || defaultId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load reports';
      setLoadError(message);
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const selectedReport: PharmOpsReportItem | undefined = catalog?.reports?.find(
    (report) => report.id === selectedId,
  );

  if (loading) {
    return (
      <div className="nc-pharmops-empty nc-pharmops-empty--loading">
        Loading reports…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={deskCalloutClass('warn')} role="alert">
        {loadError}
      </div>
    );
  }

  if (!catalog?.reports?.length) {
    return (
      <div className="nc-pharmops-empty-card">
        <div className="nc-pharmops-empty-card-title">No reports available</div>
        <div className="nc-pharmops-empty-card-body">
          Inventory reports require in-house pharmacy to be enabled.
        </div>
      </div>
    );
  }

  return (
    <div className="nc-pharmops-reports">
      <div className="nc-pharmops-reports-picker mb-3">
        <label className="sr-only" htmlFor="nc-pharmops-report-select">Report</label>
        <NativeSelect
          id="nc-pharmops-report-select"
          className="h-8 nc-pharmops-reports-select"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {catalog.reports.map((report) => (
            <option key={report.id} value={report.id}>
              {report.label}
            </option>
          ))}
        </NativeSelect>
        {selectedReport?.description ? (
          <p className="text-(--oe-nc-text-muted) text-sm mb-0 mt-2">{selectedReport.description}</p>
        ) : null}
      </div>
      {selectedReport ? (
        <div className="nc-pharmops-reports-external">
          <i className="fa fa-file-text nc-pharmops-reports-external-icon" aria-hidden="true" />
          <p className="nc-pharmops-reports-external-msg">
            This report opens in a new browser tab.
          </p>
          <Button asChild size="sm">
            <a href={selectedReport.embed_url} target="_blank" rel="noopener noreferrer">
              <i className="fa fa-external-link mr-1" aria-hidden="true" />
              Open report
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
