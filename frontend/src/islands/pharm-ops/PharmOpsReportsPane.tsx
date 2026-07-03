import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
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
      <div className="oe-nc-pharmops-empty oe-nc-pharmops-empty--loading">
        Loading reports…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="alert alert-warning" role="alert">
        {loadError}
      </div>
    );
  }

  if (!catalog?.reports?.length) {
    return (
      <div className="oe-nc-pharmops-empty-card">
        <div className="oe-nc-pharmops-empty-card__title">No reports available</div>
        <div className="oe-nc-pharmops-empty-card__body">
          Inventory reports require in-house pharmacy to be enabled.
        </div>
      </div>
    );
  }

  return (
    <div className="oe-nc-pharmops-reports">
      <div className="oe-nc-pharmops-reports__picker mb-3">
        <label className="sr-only" htmlFor="nc-pharmops-report-select">Report</label>
        <select
          id="nc-pharmops-report-select"
          className="form-control form-control-sm oe-nc-pharmops-reports__select"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {catalog.reports.map((report) => (
            <option key={report.id} value={report.id}>
              {report.label}
            </option>
          ))}
        </select>
        {selectedReport?.description ? (
          <p className="text-muted small mb-0 mt-2">{selectedReport.description}</p>
        ) : null}
      </div>
      {selectedReport?.embed_url ? (
        <iframe
          className="oe-nc-pharmops-reports__frame"
          title={selectedReport.label}
          src={selectedReport.embed_url}
        />
      ) : null}
    </div>
  );
}
