/**
 * StartVisitSuccessView — the post-submit success block shown after a visit is started.
 * Extracted from StartVisitForm for size management.
 */

import { Button } from '@components/ui/button';
import { DeskAlert } from '@components/DeskAlert';
import { CheckCircle2, Printer, SkipForward } from 'lucide-react';
import type { VisitStartData } from '@core/types';
import { SkipTriageModal } from './SkipTriageModal';

interface StartVisitSuccessViewProps {
  success: VisitStartData;
  successMsg: string;
  chiefComplaint: string;
  moduleUrl: string;
  printQueueSlip: boolean;
  canSkipTriage: boolean;
  skipModalOpen: boolean;
  skipSubmitting: boolean;
  skipError: string | null;
  displayName: string;
  pubpid: string;
  onStarted: () => void;
  onSkipOpen: () => void;
  onSkipClose: () => void;
  onSkipConfirm: (reason: string) => void;
}

export function StartVisitSuccessView({
  success,
  successMsg,
  chiefComplaint,
  moduleUrl,
  printQueueSlip,
  canSkipTriage,
  skipModalOpen,
  skipSubmitting,
  skipError,
  displayName,
  pubpid,
  onStarted,
  onSkipOpen,
  onSkipClose,
  onSkipConfirm,
}: StartVisitSuccessViewProps) {
  const visitId = success.visit.id;
  const visitState = success.visit.state;
  const showSkip = canSkipTriage && visitState === 'waiting';
  const slipUrl = success.queue_slip_url
    ?? (printQueueSlip && visitId
      ? `${moduleUrl}/queue-slip.php?visit_id=${encodeURIComponent(String(visitId))}&print=1`
      : '');
  const showPrint = printQueueSlip && success.queue_slip_enabled !== false && !!slipUrl;

  return (
    <div className="mt-3 border-t border-(--oe-nc-border) pt-4" id="nc-start-visit-success-mount">
      <DeskAlert tone="success" className="mb-4 rounded-xl flex items-start gap-3" id="nc-start-visit-success">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
        <div className="min-w-0">
          <span className="text-sm font-medium text-emerald-800">{successMsg}</span>
          {chiefComplaint.trim() && (
            <p className="text-sm text-emerald-900 mt-1.5 mb-0">
              <span className="font-medium">Reason for visit:</span> {chiefComplaint.trim()}
            </p>
          )}
        </div>
      </DeskAlert>

      <div className="flex flex-wrap gap-2">
        {showPrint && (
          <Button variant="default" size="sm" asChild>
            <a href={slipUrl} target="_blank" rel="noopener noreferrer">
              <Printer className="h-4 w-4" />
              Print queue slip
            </a>
          </Button>
        )}
        {showSkip && (
          <Button variant="warning" size="sm" id="nc-skip-to-doctor-btn" onClick={onSkipOpen}>
            <SkipForward className="h-4 w-4" />
            Skip to doctor
          </Button>
        )}
        <Button variant="outline" size="sm" id="nc-start-visit-done" onClick={onStarted}>
          Done
        </Button>
      </div>

      <SkipTriageModal
        open={skipModalOpen}
        displayName={displayName}
        pubpid={pubpid}
        submitting={skipSubmitting}
        error={skipError}
        onClose={onSkipClose}
        onConfirm={onSkipConfirm}
      />
    </div>
  );
}
