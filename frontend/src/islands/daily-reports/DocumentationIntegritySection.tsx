import { useMemo } from 'react';
import { FileSignature, RotateCcw, ShieldAlert } from 'lucide-react';
import { StatCard } from '@components/StatCard';
import { SectionBlock, SectionHeading, StatGrid } from './ReportsSections';
import type { DocumentationIntegrityReportData } from './reportsTypes';

const STAT_ICON_SIZE = 18;

const ESIGN_LABELS: Record<string, string> = {
  signature: 'Signature',
  lock: 'Lock',
  amendment: 'Amendment',
};

interface DocumentationIntegritySectionProps {
  data: DocumentationIntegrityReportData;
  ajaxUrl: string;
  facilityId?: number | string;
  startDate: string;
  endDate: string;
  onEndDateChange: (date: string) => void;
}

export function DocumentationIntegritySection({
  data,
  ajaxUrl,
  facilityId,
  startDate,
  endDate,
  onEndDateChange,
}: DocumentationIntegritySectionProps) {
  const exportUrl = useMemo(() => {
    const url = new URL(ajaxUrl, window.location.origin);
    url.searchParams.set('action', 'reports.documentation_integrity_export');
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    const id = Number(facilityId ?? 0);
    if (id > 0) {
      url.searchParams.set('facility_id', String(id));
    }
    return url.toString();
  }, [ajaxUrl, endDate, facilityId, startDate]);

  const summary = data.summary ?? {};

  return (
    <>
      <SectionBlock>
        <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
          <div>
            <label className="form-label small mb-1" htmlFor="nc-doc-integrity-end-date">
              End date
            </label>
            <input
              id="nc-doc-integrity-end-date"
              type="date"
              className="form-control form-control-sm"
              value={endDate}
              min={startDate}
              onChange={(event) => onEndDateChange(event.target.value)}
            />
          </div>
          <p className="small text-muted mb-0">
            Range: {data.start_date} – {data.end_date}
          </p>
          <a className="btn btn-outline-secondary btn-sm ms-auto" href={exportUrl}>
            Export CSV
          </a>
        </div>
      </SectionBlock>

      <SectionBlock>
        <SectionHeading>Integrity summary</SectionHeading>
        <StatGrid>
          <StatCard
            label="Visits with events"
            value={summary.visits_with_events ?? 0}
            icon={<FileSignature size={STAT_ICON_SIZE} />}
          />
          <StatCard
            label="E-sign events"
            value={summary.esign_events ?? 0}
            icon={<FileSignature size={STAT_ICON_SIZE} />}
          />
          <StatCard
            label="Amendments"
            value={summary.amendment_events ?? 0}
            icon={<FileSignature size={STAT_ICON_SIZE} />}
          />
          <StatCard
            label="Reopens"
            value={summary.reopen_events ?? 0}
            icon={<RotateCcw size={STAT_ICON_SIZE} />}
          />
          <StatCard
            label="E-sign overrides"
            value={summary.override_events ?? 0}
            icon={<ShieldAlert size={STAT_ICON_SIZE} />}
          />
        </StatGrid>
        <p className="small text-muted mb-0 mt-2">
          E-sign overrides (workflow bypass) are distinct from signature amendment notes.
        </p>
      </SectionBlock>

      <SectionBlock>
        <SectionHeading>Visits</SectionHeading>
        {(data.rows ?? []).length === 0 ? (
          <p className="text-muted mb-0">No documentation integrity events in this range.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>Queue</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>E-sign</th>
                  <th>Amendments</th>
                  <th>Reopened</th>
                  <th>Override</th>
                  <th className="text-right">Encounter</th>
                </tr>
              </thead>
              <tbody>
                {(data.rows ?? []).map((row) => {
                  const esignEvents = row.esign_events ?? [];
                  const amendmentCount = esignEvents.filter((event) => event.event_type === 'amendment').length;
                  const reopenEvents = row.reopened_events ?? [];
                  const overrideEvents = row.esign_override_events ?? [];

                  return (
                    <tr key={row.visit_id}>
                      <td>{row.queue_number}</td>
                      <td>
                        <div>{row.display_name}</div>
                        <div className="small text-muted">{row.pubpid}</div>
                      </td>
                      <td>{row.visit_date}</td>
                      <td>
                        {esignEvents.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <ul className="list-unstyled mb-0 small">
                            {esignEvents.map((event, index) => (
                              <li key={`${row.visit_id}-esign-${index}`}>
                                {ESIGN_LABELS[event.event_type] ?? event.event_type}
                                {event.signer_name ? ` · ${event.signer_name}` : ''}
                                {event.datetime ? ` · ${event.datetime}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        {amendmentCount === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <ul className="list-unstyled mb-0 small">
                            {esignEvents
                              .filter((event) => event.event_type === 'amendment')
                              .map((event, index) => (
                                <li key={`${row.visit_id}-amend-${index}`}>
                                  {event.amendment ?? 'Amendment'}
                                </li>
                              ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        {reopenEvents.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <ul className="list-unstyled mb-0 small">
                            {reopenEvents.map((event, index) => (
                              <li key={`${row.visit_id}-reopen-${index}`}>
                                {event.from_state ? `${event.from_state} → ` : ''}
                                {event.to_state ?? 'with_doctor'}
                                {event.reason ? ` · ${event.reason}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        {overrideEvents.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <ul className="list-unstyled mb-0 small">
                            {overrideEvents.map((event, index) => (
                              <li key={`${row.visit_id}-override-${index}`}>
                                {event.reason ?? 'Override'}
                                {event.actor_name ? ` · ${event.actor_name}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="text-right">
                        {row.encounter_url ? (
                          <a href={row.encounter_url} target="_blank" rel="noopener noreferrer">
                            Open
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionBlock>
    </>
  );
}
