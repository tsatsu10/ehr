import { useMemo } from 'react';
import { FileSignature, RotateCcw, ShieldAlert } from 'lucide-react';
import { StatCard } from '@components/StatCard';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { SectionBlock, SectionHeading, StatGrid } from './ReportsSections';
import type { DocumentationIntegrityReportData, DocumentationIntegritySummary } from './reportsTypes';

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

  const summary = (data.summary ?? {}) as Partial<DocumentationIntegritySummary>;

  return (
    <>
      <SectionBlock>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <Label className="normal-case font-normal mb-1" htmlFor="nc-doc-integrity-end-date">
              End date
            </Label>
            <Input
              id="nc-doc-integrity-end-date"
              type="date"
              className="h-8"
              value={endDate}
              min={startDate}
              onChange={(event) => onEndDateChange(event.target.value)}
            />
          </div>
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">
            Range: {data.start_date} – {data.end_date}
          </p>
          <Button variant="outline" size="sm" className="ms-auto" asChild>
            <a href={exportUrl}>
              Export CSV
            </a>
          </Button>
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
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0 mt-2">
          E-sign overrides (workflow bypass) are distinct from signature amendment notes.
        </p>
      </SectionBlock>

      <SectionBlock>
        <SectionHeading>Visits</SectionHeading>
        {(data.rows ?? []).length === 0 ? (
          <p className="text-[var(--oe-nc-text-muted)] mb-0">No documentation integrity events in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className={ncShadcnTableClass({ striped: true, className: 'align-middle mb-0' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>E-sign</TableHead>
                  <TableHead>Amendments</TableHead>
                  <TableHead>Reopened</TableHead>
                  <TableHead>Override</TableHead>
                  <TableHead className="text-right">Encounter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.rows ?? []).map((row) => {
                  const esignEvents = row.esign_events ?? [];
                  const amendmentCount = esignEvents.filter((event) => event.event_type === 'amendment').length;
                  const reopenEvents = row.reopened_events ?? [];
                  const overrideEvents = row.esign_override_events ?? [];

                  return (
                    <TableRow key={row.visit_id}>
                      <TableCell>{row.queue_number}</TableCell>
                      <TableCell>
                        <div>{row.display_name}</div>
                        <div className="text-sm text-[var(--oe-nc-text-muted)]">{row.pubpid}</div>
                      </TableCell>
                      <TableCell>{row.visit_date}</TableCell>
                      <TableCell>
                        {esignEvents.length === 0 ? (
                          <span className="text-[var(--oe-nc-text-muted)]">—</span>
                        ) : (
                          <ul className="list-none m-0 p-0 mb-0 text-sm">
                            {esignEvents.map((event, index) => (
                              <li key={`${row.visit_id}-esign-${index}`}>
                                {ESIGN_LABELS[event.event_type] ?? event.event_type}
                                {event.signer_name ? ` · ${event.signer_name}` : ''}
                                {event.datetime ? ` · ${event.datetime}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell>
                        {amendmentCount === 0 ? (
                          <span className="text-[var(--oe-nc-text-muted)]">—</span>
                        ) : (
                          <ul className="list-none m-0 p-0 mb-0 text-sm">
                            {esignEvents
                              .filter((event) => event.event_type === 'amendment')
                              .map((event, index) => (
                                <li key={`${row.visit_id}-amend-${index}`}>
                                  {event.amendment ?? 'Amendment'}
                                </li>
                              ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell>
                        {reopenEvents.length === 0 ? (
                          <span className="text-[var(--oe-nc-text-muted)]">—</span>
                        ) : (
                          <ul className="list-none m-0 p-0 mb-0 text-sm">
                            {reopenEvents.map((event, index) => (
                              <li key={`${row.visit_id}-reopen-${index}`}>
                                {event.from_state ? `${event.from_state} → ` : ''}
                                {event.to_state ?? 'with_doctor'}
                                {event.reason ? ` · ${event.reason}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell>
                        {overrideEvents.length === 0 ? (
                          <span className="text-[var(--oe-nc-text-muted)]">—</span>
                        ) : (
                          <ul className="list-none m-0 p-0 mb-0 text-sm">
                            {overrideEvents.map((event, index) => (
                              <li key={`${row.visit_id}-override-${index}`}>
                                {event.reason ?? 'Override'}
                                {event.actor_name ? ` · ${event.actor_name}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.encounter_url ? (
                          <a href={row.encounter_url} target="_blank" rel="noopener noreferrer">
                            Open
                          </a>
                        ) : (
                          <span className="text-[var(--oe-nc-text-muted)]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionBlock>
    </>
  );
}
