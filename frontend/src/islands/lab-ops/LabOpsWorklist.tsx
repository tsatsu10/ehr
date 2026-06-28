import type { LabOpsTab, WorklistRow } from './labOpsTypes';

interface LabOpsWorklistProps {
  tab: LabOpsTab;
  rows: WorklistRow[];
  canEnter: boolean;
  onCollect: (orderId: number) => void;
  onEnter: (orderId: number) => void;
  onSendOut: (orderId: number) => void;
}

function emptyMessage(tab: LabOpsTab): string {
  if (tab === 'send_out') {
    return 'No external (send-out) lab orders for this date. '
      + 'In-house tests stay on Pending / In progress until you release them to the doctor. '
      + 'To send a sample to an external lab, use Print requisition on the order row — that moves it here.';
  }
  if (tab === 'in_progress') {
    return 'No in-house orders awaiting result entry or release for this date.';
  }
  return 'No lab work in this tab for the selected date.';
}

export function LabOpsWorklist({
  tab,
  rows,
  canEnter,
  onCollect,
  onEnter,
  onSendOut,
}: LabOpsWorklistProps) {
  if (!rows.length) {
    return (
      <div id="nc-labops-list" className="oe-nc-labops-list" role="list" aria-label="Lab worklist">
        <div className="oe-nc-labops-empty">{emptyMessage(tab)}</div>
      </div>
    );
  }

  return (
    <div id="nc-labops-list" className="oe-nc-labops-list" role="list" aria-label="Lab worklist">
      {rows.map((row) => {
        const qLabel = row.queue_number ? `Q#${row.queue_number} ` : '';
        const reqLabel = row.fulfillment === 'send_out'
          ? 'Print requisition'
          : 'Print requisition (send-out)';

        return (
          <article
            key={row.procedure_order_id}
            className={`oe-nc-labops-row${row.is_urgent ? ' oe-nc-labops-row--urgent' : ''}`}
            role="listitem"
          >
            <div className="oe-nc-labops-row__title">
              {qLabel}{row.patient_name}
              {row.pubpid ? (
                <span className="text-muted font-weight-normal"> · {row.pubpid}</span>
              ) : null}
            </div>
            <div className="oe-nc-labops-row__meta">{row.test_names}</div>
            <div className="oe-nc-labops-row__meta">
              {row.fulfillment_label} · {row.status_label}
              {row.ordered_display ? ` · ${row.ordered_display}` : ''}
            </div>
            <div className="oe-nc-labops-row__actions">
              {row.can_open_lab_desk && row.lab_desk_url ? (
                <a className="btn btn-outline-secondary btn-sm" href={row.lab_desk_url} target="_top">
                  Open in Lab Desk
                </a>
              ) : null}
              {row.requisition_url ? (
                <a className="btn btn-outline-secondary btn-sm" href={row.requisition_url} target="_blank" rel="noreferrer">
                  {reqLabel}
                </a>
              ) : null}
              {canEnter && !row.collected && row.fulfillment !== 'send_out' ? (
                <button
                  type="button"
                  className="btn btn-outline-warning btn-sm"
                  onClick={() => onSendOut(row.procedure_order_id)}
                >
                  Mark send-out
                </button>
              ) : null}
              {canEnter && !row.collected ? (
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => onCollect(row.procedure_order_id)}
                >
                  Mark collected
                </button>
              ) : null}
              {canEnter ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onEnter(row.procedure_order_id)}
                >
                  Enter results
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
