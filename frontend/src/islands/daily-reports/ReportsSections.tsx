import { formatMoney, formatWaitMinutes } from './reportsFormatters';
import type {
  BypassLogRow,
  DailyReportData,
  DataQualitySummary,
  OpenVisitRow,
  PendingVisitAction,
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
      <div className="row mb-3">
        {[
          ['Started', visits.started],
          ['Completed', visits.completed],
          ['Still open', visits.still_open],
          ['Cancelled', visits.cancelled],
        ].map(([label, value]) => (
          <div className="col-md-3" key={label}>
            <div className="card text-center">
              <div className="card-body">
                <div className="h3 mb-0">{value}</div>
                <div className="small text-muted">{label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <h5>By state</h5>
      {!states.length ? (
        <div className="text-muted"><em>No visits on this date.</em></div>
      ) : (
        <table className="table table-sm table-bordered">
          <thead>
            <tr><th>State</th><th>Count</th></tr>
          </thead>
          <tbody>
            {states.map((state) => (
              <tr key={state}>
                <td>{state}</td>
                <td>{visits.by_state[state]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function CashSection({ cash }: { cash: DailyReportData['cash'] }) {
  return (
    <div className="row">
      <div className="col-md-4">
        <div className="card">
          <div className="card-body">
            <div className="h4 mb-0">{formatMoney(cash.total_collected)}</div>
            <div className="small text-muted">Total collected</div>
          </div>
        </div>
      </div>
      <div className="col-md-4">
        <div className="card">
          <div className="card-body">
            <div className="h4 mb-0">{cash.receipt_count}</div>
            <div className="small text-muted">Completed visits with payment</div>
          </div>
        </div>
      </div>
    </div>
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
        <div className="alert alert-success py-2">No open visits for this date.</div>
      </>
    );
  }

  const states = Object.keys(summary);

  return (
    <>
      <UnsignedAlertsBanner alerts={unsignedAlerts} />
      <h5 className="mb-2">By state</h5>
      <table className="table table-sm table-bordered mb-3">
        <thead>
          <tr><th>State</th><th>Count</th><th>Oldest wait</th></tr>
        </thead>
        <tbody>
          {states.map((state) => (
            <tr key={state}>
              <td>{state}</td>
              <td>{summary[state].count}</td>
              <td>{formatWaitMinutes(summary[state].oldest_wait_minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h5 className="mb-2">Open visit list</h5>
      <OpenVisitList
        visits={visits}
        visitBoardUrl={visitBoardUrl}
        canCancel={canCancel}
        canMarkUnpaid={canMarkUnpaid}
        onCancel={onCancel}
        onMarkUnpaid={onMarkUnpaid}
      />
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
    return <div className="alert alert-success py-2">No open visits for this date.</div>;
  }

  return (
    <table className="table table-sm table-bordered">
      <thead>
        <tr><th>Patient</th><th>State</th><th>Age</th><th>Actions</th></tr>
      </thead>
      <tbody>
        {visits.map((row) => (
          <tr key={row.id}>
            <td>#{row.queue_number} {row.display_name}</td>
            <td>{row.state}</td>
            <td>{row.wait_minutes}m</td>
            <td className="text-nowrap">
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
      </tbody>
    </table>
  );
}

export function UnpaidSection({ rows }: { rows: UnpaidVisitRow[] }) {
  if (!rows.length) {
    return <div className="text-muted"><em>No unpaid visits on this date.</em></div>;
  }

  return (
    <table className="table table-sm table-bordered">
      <thead>
        <tr><th>Patient</th><th>Charges</th><th>Reason</th><th>Marked at</th></tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={`${row.queue_number}-${idx}`}>
            <td>#{row.queue_number} {row.display_name}</td>
            <td>{formatMoney(row.charges_total)}</td>
            <td>{row.unpaid_reason || '—'}</td>
            <td>{row.left_unpaid_at || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
      <div className="row mb-3">
        {[
          ['Patients registered today', quality.patients_registered_today ?? 0],
          ['Duplicate overrides today', quality.dup_overrides_today ?? 0],
          ['Billing completion threshold', `${threshold}%`],
        ].map(([label, value]) => (
          <div className="col-md-4" key={label}>
            <div className="card text-center">
              <div className="card-body">
                <div className="h3 mb-0">{value}</div>
                <div className="small text-muted">{label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <h5>New registrations today — completion buckets</h5>
      <table className="table table-sm table-bordered mb-3">
        <thead>
          <tr><th>&lt; 40%</th><th>40–69%</th><th>70–99%</th><th>100%</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>{buckets.under_40}</td>
            <td>{buckets.from_40_to_69}</td>
            <td>{buckets.from_70_to_99}</td>
            <td>{buckets.complete_100}</td>
          </tr>
        </tbody>
      </table>
      <h5>Visits today below {threshold}% completion</h5>
      {!stale.length ? (
        <div className="text-muted"><em>No patients below billing threshold on visits today.</em></div>
      ) : (
        <table className="table table-sm table-bordered">
          <thead>
            <tr><th>Patient</th><th>MRN</th><th>Score</th></tr>
          </thead>
          <tbody>
            {stale.map((row, idx) => (
              <tr key={`${row.pubpid}-${idx}`}>
                <td>{row.display_name}</td>
                <td>{row.pubpid}</td>
                <td>{row.completion_score}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
    return <div className="text-muted"><em>No unsigned documentation on this date.</em></div>;
  }

  return (
    <table className="table table-sm table-bordered">
      <thead>
        <tr>
          <th>Patient</th><th>State</th><th>Doctor</th><th>Hours unsigned</th><th>Profile</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={`${row.queue_number}-${idx}`}>
            <td>#{row.queue_number} {row.display_name}</td>
            <td>{row.state}</td>
            <td>{row.provider_name || '—'}</td>
            <td>{row.hours_unsigned}h</td>
            <td>{row.service_profile || 'full_opd'}</td>
            <td className="text-nowrap">
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
      </tbody>
    </table>
  );
}

export function BypassSection({ rows }: { rows: BypassLogRow[] }) {
  if (!rows.length) {
    return <div className="text-muted"><em>No lab or pharmacy queue bypasses on this date.</em></div>;
  }

  return (
    <table className="table table-sm table-bordered">
      <thead>
        <tr><th>Patient</th><th>Queue</th><th>From</th><th>Reason</th><th>By</th></tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={`${row.queue_number}-${idx}`}>
            <td>#{row.queue_number} {row.display_name}</td>
            <td>{row.bypass_type}</td>
            <td>{row.from_state}</td>
            <td>{row.reason}</td>
            <td>{row.actor_name || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
