import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import {
  CalendarPlus,
  CalendarRange,
  UserCheck,
  UserX,
  PieChart,
  BellRing,
  CalendarCheck,
  AlertTriangle,
  Clock,
  Timer,
  Users,
} from 'lucide-react';
import { StatCard } from '@components/StatCard';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { SectionBlock, SectionHeading, StatGrid } from './ReportsSections';
import type { SchedulingReportData } from './reportsTypes';

const STAT_ICON_SIZE = 18;

interface SchedulingSectionProps {
  data: SchedulingReportData;
  visitDate: string;
}

export function SchedulingSection({ data, visitDate }: SchedulingSectionProps) {
  if (!data.enabled) {
    return (
      <p className="text-[var(--oe-nc-text-muted)] mb-0">Scheduling integration is off for this clinic.</p>
    );
  }

  const bridge = data.queue_bridge;
  const exportUrl = bridge?.export_url
    ? `${bridge.export_url}&visit_date=${encodeURIComponent(visitDate)}`
    : null;
  const recall = data.recall_funnel;
  const analytics = data.full_analytics?.enabled ? data.full_analytics : null;
  const latency = analytics?.check_in_latency;
  const providers = analytics?.provider_utilization?.providers ?? [];
  const onTimeWindow = analytics?.on_time_window_minutes ?? 15;

  return (
    <>
      {data.orthogonality_note && (
        <p className="nc-report-note">{data.orthogonality_note}</p>
      )}
      <SectionBlock>
        <SectionHeading>Arrivals</SectionHeading>
        <StatGrid>
          <StatCard label="Booked today" value={data.booked_today ?? 0} icon={<CalendarPlus size={STAT_ICON_SIZE} />} />
          <StatCard
            label="Booked this week"
            value={data.booked_week ?? 0}
            icon={<CalendarRange size={STAT_ICON_SIZE} />}
          />
          <StatCard label="Arrived (@)" value={data.arrival_funnel?.arrived ?? 0} icon={<UserCheck size={STAT_ICON_SIZE} />} />
          <StatCard label="No-show (?)" value={data.arrival_funnel?.no_show ?? 0} icon={<UserX size={STAT_ICON_SIZE} />} />
        </StatGrid>
        {data.week_range && (
          <p className="nc-report-note">
            Week: {data.week_range.start} – {data.week_range.end}
          </p>
        )}
      </SectionBlock>

      <SectionBlock>
        <SectionHeading>Mix &amp; recalls</SectionHeading>
        <StatGrid>
          <StatCard
            label="Scheduled mix"
            value={`${data.walk_in_vs_scheduled?.scheduled_pct ?? 0}%`}
            icon={<PieChart size={STAT_ICON_SIZE} />}
          />
          <StatCard label="Recalls due today" value={recall?.due ?? 0} icon={<BellRing size={STAT_ICON_SIZE} />} />
          <StatCard label="Recalls booked" value={recall?.booked ?? 0} icon={<CalendarCheck size={STAT_ICON_SIZE} />} />
          <StatCard label="Overdue recalls" value={recall?.overdue ?? 0} icon={<AlertTriangle size={STAT_ICON_SIZE} />} />
        </StatGrid>
        <p className="nc-report-note">
          {data.walk_in_vs_scheduled?.scheduled ?? 0} scheduled · {data.walk_in_vs_scheduled?.walk_in ?? 0} walk-in
        </p>
      </SectionBlock>

      {analytics && (
        <>
          <SectionBlock>
            <SectionHeading>Slot to check-in latency</SectionHeading>
            {latency && latency.sample_count > 0 ? (
              <>
                <StatGrid>
                  <StatCard
                    label="Median latency"
                    value={`${latency.median_minutes ?? 0} min`}
                    icon={<Timer size={STAT_ICON_SIZE} />}
                  />
                  <StatCard
                    label="P90 latency"
                    value={`${latency.p90_minutes ?? 0} min`}
                    icon={<Clock size={STAT_ICON_SIZE} />}
                  />
                  <StatCard
                    label={`On time (±${onTimeWindow} min)`}
                    value={`${latency.on_time_pct ?? 0}%`}
                    icon={<UserCheck size={STAT_ICON_SIZE} />}
                  />
                  <StatCard
                    label="Late arrivals"
                    value={latency.late_count ?? 0}
                    icon={<AlertTriangle size={STAT_ICON_SIZE} />}
                  />
                </StatGrid>
                <p className="nc-report-note">
                  {latency.sample_count} scheduled check-ins · {latency.early_count ?? 0} early · average{' '}
                  {latency.average_minutes ?? 0} min from booked slot
                </p>
              </>
            ) : (
              <p className="text-[var(--oe-nc-text-muted)] mb-0">No linked appointment check-ins for this date.</p>
            )}
          </SectionBlock>

          <SectionBlock>
            <SectionHeading>Provider utilization</SectionHeading>
            {providers.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Provider</TableHead>
                      <TableHead scope="col" className="text-right">Booked</TableHead>
                      <TableHead scope="col" className="text-right">Arrived</TableHead>
                      <TableHead scope="col" className="text-right">Visits started</TableHead>
                      <TableHead scope="col" className="text-right">Arrival %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((row) => (
                      <TableRow key={row.provider_id}>
                        <TableCell>{row.provider_name}</TableCell>
                        <TableCell className="text-right">{row.booked}</TableCell>
                        <TableCell className="text-right">{row.arrived}</TableCell>
                        <TableCell className="text-right">{row.visits_started}</TableCell>
                        <TableCell className="text-right">{row.arrival_pct}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-[var(--oe-nc-text-muted)] mb-0">
                <Users size={STAT_ICON_SIZE} className="mr-1" aria-hidden="true" />
                No provider-booked appointments for this date.
              </p>
            )}
          </SectionBlock>
        </>
      )}

      {bridge?.enabled && (
        <SectionBlock>
          <div className={`nc-report-panel${bridge.eod_block_enabled && (bridge.open_ex01_count ?? 0) > 0 ? ' nc-report-panel-warning' : ''}`}>
            <h4 className="nc-report-panel-title">Schedule vs queue exceptions</h4>
            {bridge.eod_block_enabled && (bridge.open_ex01_count ?? 0) > 0 && (
              <div className={deskCalloutClass('warn', 'py-2 mb-2')}>
                {bridge.open_ex01_count} arrived appointment(s) still have no clinical visit.
              </div>
            )}
            <p className="mb-2 text-sm text-[var(--oe-nc-text-muted)]">
              {bridge.open_action_count} need attention · {bridge.open_info_count} informational
              {bridge.by_code && (
                <> · EX-01: {bridge.by_code['EX-01']} · EX-02: {bridge.by_code['EX-02']} · EX-03: {bridge.by_code['EX-03']}</>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {bridge.hub_url && (
                <Button size="sm" asChild>
                  <a href={bridge.hub_url}>View exceptions</a>
                </Button>
              )}
              {exportUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={exportUrl}>Export EOD sweep CSV</a>
                </Button>
              )}
            </div>
          </div>
        </SectionBlock>
      )}
    </>
  );
}
