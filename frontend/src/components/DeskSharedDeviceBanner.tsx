import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import type { SharedDeviceProbeData } from '@core/useSharedDeviceSession';

interface DeskSharedDeviceBannerProps {
  prefix: string;
  probeData: SharedDeviceProbeData;
  compareMode?: 'clinical' | 'pid_only';
  restoring?: boolean;
  hint?: string;
  onRestore?: () => void;
  onReturnToQueue: () => void;
}

export function DeskSharedDeviceBanner({
  prefix,
  probeData,
  compareMode = 'clinical',
  restoring = false,
  hint = 'Restore encounter session or return to the queue before saving.',
  onRestore,
  onReturnToQueue,
}: DeskSharedDeviceBannerProps) {
  const visit = probeData.visit;
  const session = probeData.session;
  const showRestore = compareMode !== 'pid_only' && probeData.can_restore !== false && onRestore !== undefined;

  return (
    <div
      id={`${prefix}-session-banner`}
      className={deskCalloutClass('error', 'mb-3 nc-shared-device-banner')}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex justify-between items-start flex-wrap">
        <div id={`${prefix}-session-banner-text`}>
          <strong>Browser session is on another patient.</strong>
          {visit && (
            <div className="text-sm mt-1">
              Desk visit: {visit.display_name || '—'} · Queue #{visit.queue_number ?? '—'}
            </div>
          )}
          {session && (
            <div className="text-sm">
              Session patient: {session.display_name || '—'}
              {session.pubpid ? ` · MRN ${session.pubpid}` : ''}
            </div>
          )}
          <div className="text-sm mt-1">{hint}</div>
        </div>
        <div className="mt-2 md:mt-0 text-nowrap">
          {showRestore && (
            <Button
              type="button"
              id={`${prefix}-restore-session`}
              variant="outline"
              size="sm"
              className="mr-2 border-white/80 text-white hover:bg-white/10 hover:text-white"
              disabled={restoring}
              onClick={onRestore}
            >
              {restoring ? 'Restoring…' : 'Restore encounter session'}
            </Button>
          )}
          <Button
            type="button"
            id={`${prefix}-return-queue`}
            variant="outline"
            size="sm"
            onClick={onReturnToQueue}
          >
            Return to queue
          </Button>
        </div>
      </div>
    </div>
  );
}
