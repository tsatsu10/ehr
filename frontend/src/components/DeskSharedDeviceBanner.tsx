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
      className="alert alert-danger mb-3 nc-shared-device-banner"
      role="alert"
      aria-live="assertive"
    >
      <div className="d-flex justify-content-between align-items-start flex-wrap">
        <div id={`${prefix}-session-banner-text`}>
          <strong>Browser session is on another patient.</strong>
          {visit && (
            <div className="small mt-1">
              Desk visit: {visit.display_name || '—'} · Queue #{visit.queue_number ?? '—'}
            </div>
          )}
          {session && (
            <div className="small">
              Session patient: {session.display_name || '—'}
              {session.pubpid ? ` · MRN ${session.pubpid}` : ''}
            </div>
          )}
          <div className="small mt-1">{hint}</div>
        </div>
        <div className="mt-2 mt-md-0 text-nowrap">
          {showRestore && (
            <button
              type="button"
              id={`${prefix}-restore-session`}
              className="btn btn-sm btn-outline-light mr-2"
              disabled={restoring}
              onClick={onRestore}
            >
              {restoring ? 'Restoring…' : 'Restore encounter session'}
            </button>
          )}
          <button
            type="button"
            id={`${prefix}-return-queue`}
            className="btn btn-sm btn-outline-secondary"
            onClick={onReturnToQueue}
          >
            Return to queue
          </button>
        </div>
      </div>
    </div>
  );
}
