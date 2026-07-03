import type { ReactNode } from 'react';
import {
  PlayCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Banknote,
  Receipt,
  Landmark,
  Scale,
  ShieldCheck,
  UserPlus,
  Copy,
  Percent,
} from 'lucide-react';
import { formatMoney, formatWaitMinutes } from './reportsFormatters';
import { DataTable } from '@components/DataTable';
import { StatCard } from '@components/StatCard';

const STAT_ICON_SIZE = 18;
import type {
  BypassLogRow,
  DailyReportData,
  DataQualitySummary,
  OpenVisitRow,
  PendingVisitAction,
  ReconciliationSummary,
  UnpaidVisitRow,
  UnsignedAlerts,
  UnsignedVisitRow,
  VisitSummary,
} from './reportsTypes';

interface OpenActionsProps {
  visitBoardUrl: string;
  canCancel: boolean;
  canMarkUnpaid: boolean;
  onCancel: (row: OpenVisitRow) => void;
  onMarkUnpaid: (row: OpenVisitRow) => void;
}

export function SectionBlock({ children }: { children: ReactNode }) {
  return <section className="oe-nc-report-section">{children}</section>;
}

export function SectionHeading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <h3 className="oe-nc-report-heading">
      {children}
      {hint ? <span className="oe-nc-report-heading__hint">{hint}</span> : null}
    </h3>
  );
}

export function ReportEmptyState({ icon = 'fa-inbox', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="oe-nc-report-empty">
      <i className={`fa ${icon}`} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function ReportTableCard({ children }: { children: ReactNode }) {
  return <div className="oe-nc-report-table-card">{children}</div>;
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="oe-nc-report-stat-grid">{children}</div>;
}

function UnsignedAlertsBanner({ alerts }: { alerts: UnsignedAlerts }) {
  const withDoctor = Number(alerts.with_doctor) || 0;
  const readyPayment = Number(alerts.ready_for_payment) || 0;
  if (!withDoctor && !readyPayment) return null;

  return (
    <div className="alert alert-warning py-2 mb-3">
      <strong>Documentation gaps (unsigned)</strong>
      <ul className="mb-0 pl-3">
        {withDoctor > 0 && <li>With doctor + unsigned note: {withDoctor}</li>}
        {readyPayment > 0 && <li>Ready for payment + unsigned: {readyPayment}</li>}
      </ul>
    </div>
  );
}

export function VisitsSection({ visits }: { visits: VisitSummary }) {
  const states = Object.keys(visits.by_state ?? {}).sort();

  return (
    <>
      <SectionBlock>
        <StatGrid>
          <StatCard label="Started" value={visits.started} icon={<PlayCircle size={STAT_ICON_SIZE} />} />
          <StatCard label="Completed" value={visits.completed} icon={<CheckCircle2 size={STAT_ICON_SIZE} />} />
          <StatCard label="Still open" value={visits.still_open} icon={<Clock size={STAT_ICON_SIZE} />} />
          <StatCard label="Cancelled" value={visits.cancelled} icon={<XCircle size={STAT_ICON_SIZE} />} />
        </StatGrid>
      </SectionBlock>
      <SectionBlock>
        <SectionHeading>By state</SectionHeading>
        {!states.length ? (
          <ReportEmptyState icon="fa-calendar-o">No visits on this date.</ReportEmptyState>
        ) : (
          <ReportTableCard>
            <DataTable hover header={<tr><th>State</th><th className="text-right">Count</th></tr>}>
              {states.map((state) => (
                <tr key={state}>
                  <td>{state}</td>
                  <td className="text-right">{visits.by_state[state]}</td>
                </tr>
              ))}
            </DataTable>
          </ReportTableCard>
        )}
      </SectionBlock>
    </>
  );
}

export function CashSection({ cash }: { cash: DailyReportData['cash'] }) {
  const categories = cash.by_category ?? [];

  return (
    <>
      <SectionBlock>
        <StatGrid>
          <StatCard label="Total collected" value={formatMoney(cash.total_collected)} icon={<Banknote size={STAT_ICON_SIZE} />} />
          <StatCard label="Completed visits with payment" value={cash.receipt_count} icon={<Receipt size={STAT_ICON_SIZE} />} />
        </StatGrid>
      </SectionBlock>
      <SectionBlock>
        <SectionHeading>By fee category</SectionHeading>
        {!categories.length ? (
          <ReportEmptyState icon="fa-money">No completed visit charges for this date.</ReportEmptyState>
        ) : (
          <ReportTableCard>
            <DataTable hover header={<tr><th>Category</th><th className="text-right">Amount</th></tr>}>
              {categories.map((row) => (
                <tr key={row.category}>
                  <td>{row.label}</td>
                  <td className="text-right">{formatMoney(row.amount)}</td>
                </tr>
              ))}
            </DataTable>
          </ReportTableCard>
        )}
      </SectionBlock>
    </>
  );
}

export function ReconciliationSection({
  reconciliation,
  canRun,
  running,
  runError,
  onRun,
}: {
  reconciliation: ReconciliationSummary;
  canRun: boolean;
  running: boolean;
  runError: string | null;
  onRun: () => void;
}) {
  const isOk = reconciliation.status === 'ok';
  const recentRuns = reconciliation.recent_runs ?? [];

  return (
    <>
      <SectionBlock>
        <StatGrid>
          <StatCard label="Module receipts" value={formatMoney(reconciliation.module_total)} icon={<Receipt size={STAT_ICON_SIZE} />} />
          <StatCard label="Core payments" value={formatMoney(reconciliation.core_total)} icon={<Landmark size={STAT_ICON_SIZE} />} />
          <StatCard label="Delta" value={formatMoney(reconciliation.delta_amount)} icon={<Scale size={STAT_ICON_SIZE} />} />
          <StatCard
            label="Status"
            value={
              <span className={isOk ? 'text-success' : 'text-warning'}>
                {isOk ? 'OK' : 'Warning'}
              </span>
            }
            icon={<ShieldCheck size={STAT_ICON_SIZE} />}
          />
        </StatGrid>
        <p className="oe-nc-report-note">Tolerance {formatMoney(reconciliation.tolerance)}</p>
      </SectionBlock>

      {canRun && (
        <SectionBlock>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={onRun}
            disabled={running}
          >
            {running ? 'Running…' : 'Run reconciliation now'}
          </button>
          {runError && <div className="text-danger small mt-2">{runError}</div>}
        </SectionBlock>
      )}

      <SectionBlock>
        <SectionHeading>Recent runs</SectionHeading>
        {!recentRuns.length ? (
          <ReportEmptyState icon="fa-history">No reconciliation runs recorded yet.</ReportEmptyState>
        ) : (
          <ReportTableCard>
            <DataTable
              hover
              header={(
                <tr>
                  <th>Date</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th className="text-right">Delta</th>
                  <th>Completed</th>
                </tr>
              )}
            >
              {recentRuns.map((run) => (
                <tr key={run.id}>
                  <td>{run.run_date}</td>
                  <td>{run.trigger}</td>
                  <td className={run.status === 'ok' ? 'text-success' : 'text-warning'}>{run.status}</td>
                  <td className="text-right">{formatMoney(run.delta_amount)}</td>
                  <td>{run.completed_at || '—'}</td>
                </tr>
              ))}
            </DataTable>
          </ReportTableCard>
        )}
      </SectionBlock>
    </>
  );
}

export function EodOpenSection({
  summary,
  visits,
  unsignedAlerts,
  visitBoardUrl,
  canCancel,
  canMarkUnpaid,
  onCancel,
  onMarkUnpaid,
}: {
  summary: Record<string, { count: number; oldest_wait_minutes: number }>;
  visits: OpenVisitRow[];
  unsignedAlerts: UnsignedAlerts;
} & OpenActionsProps) {
  if (!visits.length) {
    return (
      <>
        <UnsignedAlertsBanner alerts={unsignedAlerts} />
        <div className="alert alert-success py-2 mb-0">No open visits for this date.</div>
      </>
    );
  }

  const states = Object.keys(summary);

  return (
    <>
      <UnsignedAlertsBanner alerts={unsignedAlerts} />
      <SectionBlock>
        <SectionHeading>By state</SectionHeading>
        <ReportTableCard>
          <DataTable
            hover
            header={<tr><th>State</th><th className="text-right">Count</th><th>Oldest wait</th></tr>}
          >
            {states.map((state) => (
              <tr key={state}>
                <td>{state}</td>
                <td className="text-right">{summary[state].count}</td>
                <td>{formatWaitMinutes(summary[state].oldest_wait_minutes)}</td>
              </tr>
            ))}
          </DataTable>
        </ReportTableCard>
      </SectionBlock>
      <SectionBlock>
        <SectionHeading>Open visit list</SectionHeading>
        <OpenVisitList
          visits={visits}
          visitBoardUrl={visitBoardUrl}
          canCancel={canCancel}
          canMarkUnpaid={canMarkUnpaid}
          onCancel={onCancel}
          onMarkUnpaid={onMarkUnpaid}
        />
      </SectionBlock>
    </>
  );
}

function OpenVisitList({
  visits,
  visitBoardUrl,
  canCancel,
  canMarkUnpaid,
  onCancel,
  onMarkUnpaid,
}: { visits: OpenVisitRow[] } & OpenActionsProps) {
  if (!visits.length) {
    return <div className="alert alert-success py-2 mb-0">No open visits for this date.</div>;
  }

  return (
    <ReportTableCard>
      <DataTable
        hover
        header={<tr><th>Patient</th><th>State</th><th>Age</th><th className="text-right">Actions</th></tr>}
      >
        {visits.map((row) => (
          <tr key={row.id}>
            <td>#{row.queue_number} {row.display_name}</td>
            <td>{row.state}</td>
            <td>{row.wait_minutes}m</td>
            <td className="text-nowrap text-right">
              <a className="btn btn-sm btn-outline-secondary mr-1" href={visitBoardUrl} target="_top">
                Visit Board
              </a>
              {canMarkUnpaid && row.state === 'ready_for_payment' && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-warning mr-1"
                  onClick={() => onMarkUnpaid(row)}
                >
                  Mark unpaid
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => onCancel(row)}
                >
                  Cancel
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </ReportTableCard>
  );
}

export function UnpaidSection({ rows }: { rows: UnpaidVisitRow[] }) {
  if (!rows.length) {
    return <ReportEmptyState icon="fa-check-circle">No unpaid visits on this date.</ReportEmptyState>;
  }

  return (
    <ReportTableCard>
      <DataTable
        hover
        header={<tr><th>Patient</th><th className="text-right">Charges</th><th>Reason</th><th>Marked at</th></tr>}
      >
        {rows.map((row, idx) => (
          <tr key={`${row.queue_number}-${idx}`}>
            <td>#{row.queue_number} {row.display_name}</td>
            <td className="text-right">{formatMoney(row.charges_total)}</td>
            <td>{row.unpaid_reason || '—'}</td>
            <td>{row.left_unpaid_at || '—'}</td>
          </tr>
        ))}
      </DataTable>
    </ReportTableCard>
  );
}

export function DataQualitySection({ quality }: { quality: DataQualitySummary }) {
  const buckets = quality.completion_buckets ?? {
    under_40: 0,
    from_40_to_69: 0,
    from_70_to_99: 0,
    complete_100: 0,
  };
  const threshold = quality.billing_threshold ?? 70;
  const stale = quality.stale_incomplete ?? [];

  return (
    <>
      <SectionBlock>
        <StatGrid>
          <StatCard label="Patients registered today" value={quality.patients_registered_today ?? 0} icon={<UserPlus size={STAT_ICON_SIZE} />} />
          <StatCard label="Duplicate overrides today" value={quality.dup_overrides_today ?? 0} icon={<Copy size={STAT_ICON_SIZE} />} />
          <StatCard label="Billing completion threshold" value={`${threshold}%`} icon={<Percent size={STAT_ICON_SIZE} />} />
        </StatGrid>
      </SectionBlock>

      <SectionBlock>
        <SectionHeading>New registrations today — completion buckets</SectionHeading>
        <ReportTableCard>
          <DataTable
            hover
            header={(
              <tr>
                <th className="text-right">&lt; 40%</th>
                <th className="text-right">40–69%</th>
                <th className="text-right">70–99%</th>
                <th className="text-right">100%</th>
              </tr>
            )}
          >
            <tr>
              <td className="text-right">{buckets.under_40}</td>
              <td className="text-right">{buckets.from_40_to_69}</td>
              <td className="text-right">{buckets.from_70_to_99}</td>
              <td className="text-right">{buckets.complete_100}</td>
            </tr>
          </DataTable>
        </ReportTableCard>
      </SectionBlock>

      {(quality.by_registering_user?.length ?? 0) > 0 && (
        <SectionBlock>
          <SectionHeading>By registering user</SectionHeading>
          <ReportTableCard>
            <DataTable
              hover
              header={(
                <tr>
                  <th>Registrar</th>
                  <th className="text-right">Registered</th>
                  <th className="text-right">&lt; 40%</th>
                  <th className="text-right">40–69%</th>
                  <th className="text-right">70–99%</th>
                  <th className="text-right">100%</th>
                </tr>
              )}
            >
              {quality.by_registering_user!.map((row) => (
                <tr key={row.registrar}>
                  <td>{row.registrar}</td>
                  <td className="text-right">{row.patients_registered}</td>
                  <td className="text-right">{row.completion_buckets.under_40}</td>
                  <td className="text-right">{row.completion_buckets.from_40_to_69}</td>
                  <td className="text-right">{row.completion_buckets.from_70_to_99}</td>
                  <td className="text-right">{row.completion_buckets.complete_100}</td>
                </tr>
              ))}
            </DataTable>
          </ReportTableCard>
        </SectionBlock>
      )}

      <SectionBlock>
        <SectionHeading>{`Visits today below ${threshold}% completion`}</SectionHeading>
        {!stale.length ? (
          <ReportEmptyState icon="fa-check-circle">
            No patients below billing threshold on visits today.
          </ReportEmptyState>
        ) : (
          <ReportTableCard>
            <DataTable hover header={<tr><th>Patient</th><th>MRN</th><th className="text-right">Score</th></tr>}>
              {stale.map((row, idx) => (
                <tr key={`${row.pubpid}-${idx}`}>
                  <td>{row.display_name}</td>
                  <td>{row.pubpid}</td>
                  <td className="text-right">{row.completion_score}%</td>
                </tr>
              ))}
            </DataTable>
          </ReportTableCard>
        )}
      </SectionBlock>
    </>
  );
}

export function UnsignedSection({
  rows,
  visitBoardUrl,
}: {
  rows: UnsignedVisitRow[];
  visitBoardUrl: string;
}) {
  if (!rows.length) {
    return <ReportEmptyState icon="fa-check-circle">No unsigned documentation on this date.</ReportEmptyState>;
  }

  return (
    <ReportTableCard>
      <DataTable
        hover
        header={(
          <tr>
            <th>Patient</th><th>State</th><th>Doctor</th><th className="text-right">Hours unsigned</th><th>Profile</th><th className="text-right">Actions</th>
          </tr>
        )}
      >
        {rows.map((row, idx) => (
          <tr key={`${row.queue_number}-${idx}`}>
            <td>#{row.queue_number} {row.display_name}</td>
            <td>{row.state}</td>
            <td>{row.provider_name || '—'}</td>
            <td className="text-right">{row.hours_unsigned}h</td>
            <td>{row.service_profile || 'full_opd'}</td>
            <td className="text-nowrap text-right">
              <a
                className="btn btn-sm btn-outline-primary mr-1"
                href={row.encounter_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Encounter
              </a>
              <a className="btn btn-sm btn-outline-secondary" href={visitBoardUrl} target="_top">
                Visit Board
              </a>
            </td>
          </tr>
        ))}
      </DataTable>
    </ReportTableCard>
  );
}

export function BypassSection({ rows }: { rows: BypassLogRow[] }) {
  if (!rows.length) {
    return <ReportEmptyState icon="fa-random">No lab or pharmacy queue bypasses on this date.</ReportEmptyState>;
  }

  return (
    <ReportTableCard>
      <DataTable
        hover
        header={<tr><th>Patient</th><th>Queue</th><th>From</th><th>Reason</th><th>By</th></tr>}
      >
        {rows.map((row, idx) => (
          <tr key={`${row.queue_number}-${idx}`}>
            <td>#{row.queue_number} {row.display_name}</td>
            <td>{row.bypass_type}</td>
            <td>{row.from_state}</td>
            <td>{row.reason}</td>
            <td>{row.actor_name || '—'}</td>
          </tr>
        ))}
      </DataTable>
    </ReportTableCard>
  );
}

export function openVisitToPending(row: OpenVisitRow): PendingVisitAction {
  return {
    visitId: row.id,
    rowVersion: row.row_version,
    displayName: row.display_name,
    pubpid: row.pubpid,
  };
}
