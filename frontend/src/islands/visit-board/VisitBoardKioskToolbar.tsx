interface VisitBoardKioskToolbarProps {
  clinicName: string;
  lastUpdated: Date | null;
  isFullscreen: boolean;
  privacyMode: boolean;
  onToggleFullscreen: () => void;
  onPrivacyModeChange: (enabled: boolean) => void;
  onRefresh: () => void;
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function VisitBoardKioskToolbar({
  clinicName,
  lastUpdated,
  isFullscreen,
  privacyMode,
  onToggleFullscreen,
  onPrivacyModeChange,
  onRefresh,
}: VisitBoardKioskToolbarProps) {
  return (
    <div className="oe-nc-vb__kiosk-toolbar d-flex flex-wrap align-items-center gap-2 mb-3">
      <div className="oe-nc-vb__kiosk-toolbar__title">
        <strong>{clinicName}</strong>
        <span className="text-muted small ms-2">Wall display</span>
      </div>
      <div className="ms-auto d-flex flex-wrap align-items-center gap-2">
        {lastUpdated && (
          <span className="small text-muted">
            Updated {formatClockTime(lastUpdated)}
          </span>
        )}
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={onRefresh}
        >
          Refresh
        </button>
        <button
          type="button"
          className={`btn btn-sm ${privacyMode ? 'btn-secondary' : 'btn-outline-secondary'}`}
          aria-pressed={privacyMode}
          onClick={() => onPrivacyModeChange(!privacyMode)}
        >
          {privacyMode ? 'Privacy on' : 'Privacy off'}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => { void onToggleFullscreen(); }}
        >
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
      </div>
    </div>
  );
}
