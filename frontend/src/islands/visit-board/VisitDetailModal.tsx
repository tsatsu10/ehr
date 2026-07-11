import { useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { StatusPill } from '@components/StatusPill';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { AncillaryVisitBadges, isAncillaryVisitBadgeKey } from '@components/AncillaryVisitBadges';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';
import { cn } from '@/lib/utils';
import { useModalDismiss } from '@components/useModalDismiss';
import { resolveQueueBridgeException } from '@islands/queue-bridge/queueBridgeApi';
import type { VisitDetailData } from '@core/types';
import { deskActionForState } from './visitBoardUtils';

/** Visit states from which a visit can be routed back to the doctor (workflows §12.2). */
const REOPEN_SOURCE_STATES = ['ready_for_lab', 'ready_for_pharmacy', 'ready_for_payment', 'lab_complete', 'pharmacy_complete'];

interface VisitDetailModalProps {
  visitId: number | null;
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  canCancel: boolean;
  canSendBackToDoctor?: boolean;
  deskUrls: Record<string, string>;
  onClose: () => void;
  onOpenDrawer: (data: VisitDetailData) => void;
  onVisitCancelled: () => void;
  onVisitSentBackToDoctor?: () => void;
  onQueueBridgeResolved?: () => void;
}

function SummaryBadges({ badges }: { badges: string[] }) {
  if (!badges.length) return null;

  const ancillaryBadges = badges.filter(isAncillaryVisitBadgeKey);

  return (
    <div className="nc-visit-summary__badges mt-2">
      {badges.includes('urgent') && (
        <Badge variant="warning" className="mr-1">URGENT</Badge>
      )}
      {badges.includes('skipped_triage') && (
        <Badge variant="neutral" className="mr-1">Skipped triage</Badge>
      )}
      <AncillaryVisitBadges badges={ancillaryBadges} className="mr-1" />
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
  canSendBackToDoctor = false,
  deskUrls,
  onClose,
  onOpenDrawer,
  onVisitCancelled,
  onVisitSentBackToDoctor,
  onQueueBridgeResolved,
}: VisitDetailModalProps) {
  const [data, setData] = useState<VisitDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const [linking, setLinking] = useState(false);

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

  const handleSendBackToDoctor = async () => {
    if (!data?.visit || sendingBack) return;

    setSendingBack(true);
    setActionError(null);
    try {
      await oeFetch('visit.send_back_to_doctor', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          visit_id: data.visit.id,
          row_version: data.visit.row_version ?? 0,
        },
        params: facilityId > 0 ? { facility_id: facilityId } : undefined,
      });
      onVisitSentBackToDoctor?.();
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Send back to doctor failed');
    } finally {
      setSendingBack(false);
    }
  };

  const handleLinkAppointment = async () => {
    const bridgeAction = data?.queue_bridge_action;
    if (!bridgeAction?.can_resolve || linking) {
      return;
    }

    setLinking(true);
    setActionError(null);
    try {
      await resolveQueueBridgeException(ajaxUrl, csrfToken, {
        exception_code: bridgeAction.exception_code,
        action: 'link_appointment',
        pid: bridgeAction.pid,
        pc_eid: bridgeAction.pc_eid,
        visit_id: bridgeAction.visit_id,
        appt_date: bridgeAction.appt_date,
      });
      onQueueBridgeResolved?.();
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Link appointment failed');
    } finally {
      setLinking(false);
    }
  };

  if (!visitId) return null;

  const summary = data?.visit_summary;
  const visit = data?.visit;
  const preview = data?.preview;
  const identity = preview?.identity;
  const completion = preview?.completion;
  const bridgeAction = data?.queue_bridge_action;
  const deskAction = visit ? deskActionForState(visit.state, deskUrls) : null;
  const chartUrl = completion?.chart_open_url || completion?.chart_url || '';
  const title = summary
    ? `Visit #${summary.queue_number || visit?.queue_number || '?'} — ${summary.state_label}`
    : `Visit #${visitId} — …`;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-visit-modal"
        className={cn(dialogContentSizeClass.sm, 'nc-visit-detail-modal')}
        aria-labelledby="nc-visit-modal-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-visit-modal-title">{title}</DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody id="nc-visit-modal-body">
          {loading && <em>Loading…</em>}
          {error && (
            <div className={deskCalloutClass('error', 'text-sm mb-0')} role="alert">
              {error}
            </div>
          )}
          {!loading && !error && data && preview && summary && visit && identity && (
            <>
              {bridgeAction && (
                <div className={deskCalloutClass('info', 'text-sm mb-3')}>
                  {bridgeAction.summary}
                  {bridgeAction.appt_time_label ? ` · Appt ${bridgeAction.appt_time_label}` : ''}
                  {bridgeAction.hub_url && (
                    <>
                      {' '}
                      <a href={bridgeAction.hub_url}>Open Queue Bridge</a>
                    </>
                  )}
                </div>
              )}
              <PatientContextBanner
                layout="compact"
                identity={identity}
                completion={completion}
                safety={preview.safety}
                bannerMrdDeepLinks={preview.banner_mrd_deep_links}
                showAllergyCountChip={preview.allergy_count_chip}
                chiefComplaint={summary.chief_complaint ?? visit.chief_complaint}
                chiefComplaintId="nc-visit-modal-cc"
                aside={(
                  <StatusPill
                    state={visit.state}
                    queueNumber={String(visit.queue_number)}
                  />
                )}
                className="mb-2"
                id="nc-visit-modal-banner"
              />
              <div className="nc-visit-summary mt-2 mb-2">
                <div className="text-[var(--oe-nc-text-muted)]">
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
            <div className={deskCalloutClass('error', 'text-sm mt-2 mb-0')} role="alert">
              {actionError}
            </div>
          )}
        </DialogBody>
        {!loading && !error && data && visit && (
          <DialogFooter className="justify-start flex-wrap" id="nc-visit-modal-footer">
            {bridgeAction?.can_resolve && (
              <Button
                type="button"
                id="nc-modal-link-appointment"
                disabled={linking}
                onClick={() => void handleLinkAppointment()}
              >
                {linking ? 'Linking…' : bridgeAction.label}
              </Button>
            )}
            {deskAction && (
              <Button asChild>
                <a href={deskAction.url} target="_top">
                  {deskAction.label}
                </a>
              </Button>
            )}
            {chartUrl && (
              <Button asChild variant="outline">
                <a href={chartUrl} target="_blank" rel="noopener noreferrer">
                  Open full chart
                </a>
              </Button>
            )}
            {canSendBackToDoctor && REOPEN_SOURCE_STATES.includes(visit.state) && (
              <Button
                type="button"
                variant="outline"
                id="nc-modal-send-back-to-doctor"
                disabled={sendingBack}
                onClick={() => void handleSendBackToDoctor()}
              >
                {sendingBack ? 'Sending…' : 'Send back to doctor'}
              </Button>
            )}
            {canCancel && visit.state !== 'cancelled' && visit.state !== 'completed' && (
              <Button
                type="button"
                variant="outline"
                className="text-[var(--oe-nc-danger,#dc2626)] border-[var(--oe-nc-danger,#dc2626)] hover:bg-red-50"
                id="nc-modal-cancel"
                disabled={cancelling}
                onClick={() => void handleCancel()}
              >
                Cancel visit
              </Button>
            )}
            <Button
              type="button"
              variant="link"
              id="nc-modal-more-details"
              onClick={() => onOpenDrawer(data)}
            >
              More details…
            </Button>
            <Button
              type="button"
              variant="secondary"
              id="nc-modal-close"
              onClick={onClose}
            >
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
