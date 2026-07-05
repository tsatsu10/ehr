import { Button } from '@components/ui/button';
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
      <div id="nc-labops-list" className="nc-labops-list" role="list" aria-label="Lab worklist">
        <div className="nc-labops-empty">{emptyMessage(tab)}</div>
      </div>
    );
  }

  return (
    <div id="nc-labops-list" className="nc-labops-list" role="list" aria-label="Lab worklist">
      {rows.map((row) => {
        const qLabel = row.queue_number ? `Q#${row.queue_number} ` : '';
        const reqLabel = row.fulfillment === 'send_out'
          ? 'Print requisition'
          : 'Print requisition (send-out)';

        return (
          <article
            key={row.procedure_order_id}
            className={`nc-labops-row${row.is_urgent ? ' nc-labops-row-urgent' : ''}`}
            role="listitem"
          >
            <div className="nc-labops-row-title">
              {qLabel}{row.patient_name}
              {row.pubpid ? (
                <span className="text-[var(--oe-nc-text-muted)] font-normal"> · {row.pubpid}</span>
              ) : null}
            </div>
            <div className="nc-labops-row-meta">{row.test_names}</div>
            <div className="nc-labops-row-meta">
              {row.fulfillment_label} · {row.status_label}
              {row.ordered_display ? ` · ${row.ordered_display}` : ''}
            </div>
            <div className="nc-labops-row-actions">
              {row.can_open_lab_desk && row.lab_desk_url ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={row.lab_desk_url} target="_top">
                    Open in Lab Desk
                  </a>
                </Button>
              ) : null}
              {row.requisition_url ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={row.requisition_url} target="_blank" rel="noreferrer">
                    {reqLabel}
                  </a>
                </Button>
              ) : null}
              {canEnter && !row.collected && row.fulfillment !== 'send_out' ? (
                <Button
                  type="button"
                  variant="warning"
                  size="sm"
                  onClick={() => onSendOut(row.procedure_order_id)}
                >
                  Mark send-out
                </Button>
              ) : null}
              {canEnter && !row.collected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCollect(row.procedure_order_id)}
                >
                  Mark collected
                </Button>
              ) : null}
              {canEnter ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onEnter(row.procedure_order_id)}
                >
                  Enter results
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
