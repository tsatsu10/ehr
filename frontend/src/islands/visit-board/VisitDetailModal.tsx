import { useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { StatusPill } from '@components/StatusPill';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { useModalDismiss } from '@components/useModalDismiss';
import type { VisitDetailData } from '@core/types';
import { deskActionForState } from './visitBoardUtils';

interface VisitDetailModalProps {
  visitId: number | null;
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  canCancel: boolean;
  deskUrls: Record<string, string>;
  onClose: () => void;
  onOpenDrawer: (data: VisitDetailData) => void;
  onVisitCancelled: () => void;
}

function SummaryBadges({ badges }: { badges: string[] }) {
  if (!badges.length) return null;

  return (
    <div className="nc-visit-summary__badges mt-2">
      {badges.includes('urgent') && (
        <span className="badge badge-warning mr-1">URGENT</span>
      )}
      {badges.includes('skipped_triage') && (
        <span className="badge badge-secondary">Skipped triage</span>
      )}
    </div>
  );
}

export function VisitDetailModal({
  visitId,
  open,
  ajaxUrl,
  csrfToken,
  facilityId,
  canCancel,
  deskUrls,
  onClose,
  onOpenDrawer,
  onVisitCancelled,
}: VisitDetailModalProps) {
  const [data, setData] = useState<VisitDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useModalDismiss(open, onClose);

  useEffect(() => {
    if (!open || !visitId) {
      setData(null);
      setError(null);
      setActionError(null);
      return undefined;
    }

    let cancelled = false;

    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      setActionError(null);
      try {
        const result = await oeFetch<VisitDetailData>('visit.detail', {
          ajaxUrl,
          csrfToken,
          method: 'POST',
          json: { visit_id: visitId },
          params: facilityId > 0 ? { facility_id: facilityId } : undefined,
        });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load visit detail');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [ajaxUrl, csrfToken, facilityId, open, visitId]);

  const handleCancel = async () => {
    if (!data?.visit || cancelling) return;

    const reason = window.prompt('Cancel reason:');
    if (!reason) return;

    setCancelling(true);
    setActionError(null);
    try {
      await oeFetch('visit.cancel', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          visit_id: data.visit.id,
          row_version: data.visit.row_version ?? 0,
          reason,
        },
        params: facilityId > 0 ? { facility_id: facilityId } : undefined,
      });
      onVisitCancelled();
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  if (!open || !visitId) return null;

  const summary = data?.visit_summary;
  const visit = data?.visit;
  const preview = data?.preview;
  const identity = preview?.identity;
  const completion = preview?.completion;
  const deskAction = visit ? deskActionForState(visit.state, deskUrls) : null;
  const chartUrl = completion?.chart_open_url || completion?.chart_url || '';
  const title = summary
    ? `Visit #${summary.queue_number || visit?.queue_number || '?'} — ${summary.state_label}`
    : `Visit #${visitId} — …`;

  return (
    <>
      <div
        className="modal fade show d-block nc-visit-detail-modal"
        id="nc-visit-modal"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="nc-visit-modal-title"
        aria-modal="true"
      >
        <div className="modal-dialog modal-sm" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="nc-visit-modal-title">{title}</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body" id="nc-visit-modal-body">
              {loading && <em>Loading…</em>}
              {error && <div className="alert alert-danger mb-0">{error}</div>}
              {!loading && !error && data && preview && summary && visit && identity && (
                <>
                  {completion
                    && completion.score < (completion.billing_threshold || 70) && (
                    <div className="alert alert-warning py-2 mb-2">
                      Profile incomplete for billing — {completion.score}% of{' '}
                      {completion.billing_threshold || 70}% required.
                    </div>
                  )}
                  <div className="nc-patient-context-banner mb-2">
                    <strong>{identity.display_name}</strong>
                    <div className="small text-muted">
                      {identity.sex || '—'} · {identity.age_years ?? '—'} · MRN {identity.pubpid}
                    </div>
                    <div className="mt-2">
                      <StatusPill
                        state={visit.state}
                        queueNumber={String(visit.queue_number)}
                      />
                    </div>
                  </div>
                  <div className="nc-visit-summary mt-2 mb-2">
                    <div className="text-muted">
                      {summary.visit_type_label}
                      {summary.started_at_label ? ` · Started ${summary.started_at_label}` : ''}
                      {' · Wait '}
                      <WaitTimeSpan
                        card={{
                          wait_minutes: summary.wait_minutes,
                          wait_label: summary.wait_label,
                          visit_date: summary.visit_date,
                        }}
                      />
                      {` · Dr hint: ${summary.provider_hint || 'Unassigned'}`}
                    </div>
                    <SummaryBadges badges={summary.badges ?? []} />
                  </div>
                </>
              )}
              {actionError && (
                <div className="alert alert-danger mt-2 mb-0">{actionError}</div>
              )}
            </div>
            {!loading && !error && data && visit && (
              <div
                className="modal-footer flex-wrap justify-content-start"
                id="nc-visit-modal-footer"
              >
                {deskAction && (
                  <a
                    className="btn btn-primary mb-1 mr-1"
                    href={deskAction.url}
                    target="_top"
                  >
                    {deskAction.label}
                  </a>
                )}
                {chartUrl && (
                  <a
                    className="btn btn-outline-secondary mb-1 mr-1"
                    href={chartUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open full chart
                  </a>
                )}
                {canCancel && visit.state !== 'cancelled' && visit.state !== 'completed' && (
                  <button
                    type="button"
                    className="btn btn-outline-danger mb-1 mr-1"
                    id="nc-modal-cancel"
                    disabled={cancelling}
                    onClick={() => void handleCancel()}
                  >
                    Cancel visit
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-link mb-1 mr-1"
                  id="nc-modal-more-details"
                  onClick={() => onOpenDrawer(data)}
                >
                  More details…
                </button>
                <button
                  type="button"
                  className="btn btn-secondary mb-1"
                  id="nc-modal-close"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        id="nc-visit-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  );
}
