import type { VisitDetailAuditItem, VisitDetailData } from '@core/types';
import { useModalDismiss } from '@components/useModalDismiss';

interface VisitDetailDrawerProps {
  open: boolean;
  data: VisitDetailData | null;
  onClose: () => void;
}

function AuditTimeline({ items }: { items: VisitDetailAuditItem[] }) {
  if (!items.length) {
    return <em className="text-muted small">No recent activity.</em>;
  }

  return (
    <ul className="list-unstyled mb-0">
      {items.map((item, index) => (
        <li key={`${item.at}-${index}`} className="mb-2">
          <div>{item.label}</div>
          {item.subtitle && <div className="small text-muted">{item.subtitle}</div>}
          {item.at_label && <div className="small text-muted">{item.at_label}</div>}
        </li>
      ))}
    </ul>
  );
}

export function VisitDetailDrawer({ open, data, onClose }: VisitDetailDrawerProps) {
  useModalDismiss(open, onClose);

  if (!open || !data) return null;

  const summary = data.visit_summary;
  const visit = data.visit;
  const title = `#${summary.queue_number || visit.queue_number || '?'} · ${
    summary.state_label || visit.state
  }`;

  return (
    <>
      <div
        className="nc-visit-detail-drawer show"
        id="nc-visit-detail-drawer"
        aria-hidden="false"
      >
        <div
          className="nc-visit-detail-drawer__panel"
          role="dialog"
          aria-labelledby="nc-visit-drawer-title"
        >
          <div className="nc-visit-detail-drawer__header">
            <h5 className="mb-0" id="nc-visit-drawer-title">{title}</h5>
            <button type="button" className="close" aria-label="Close drawer" onClick={onClose}>
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div className="nc-visit-detail-drawer__body" id="nc-visit-drawer-body">
            <div className="mb-3">
              <div><strong>{summary.state_label || visit.state}</strong></div>
              <div className="small text-muted">
                {summary.visit_type_label}
                {summary.started_at_label ? ` · Started ${summary.started_at_label}` : ''}
                {summary.provider_hint ? ` · ${summary.provider_hint}` : ''}
              </div>
              {summary.chief_complaint && (
                <div className="small mt-2">
                  <strong>Chief complaint:</strong> {summary.chief_complaint}
                </div>
              )}
            </div>
            <h6 className="small text-uppercase text-muted">Audit timeline</h6>
            <AuditTimeline items={data.audit_timeline ?? []} />
          </div>
          <div className="nc-visit-detail-drawer__footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close drawer
            </button>
            {data.chart_history_url && (
              <a
                className="btn btn-outline-primary btn-sm"
                id="nc-visit-drawer-history"
                href={data.chart_history_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View full history
              </a>
            )}
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  );
}
