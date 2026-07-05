import { Button } from '@components/ui/button';
import {
  visitBoardKioskToolbarClass,
  visitBoardKioskTitleClass,
} from '@components/visitBoardStyles';

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
    <div className={`${visitBoardKioskToolbarClass} flex flex-wrap items-center gap-2 mb-3`}>
      <div className={visitBoardKioskTitleClass}>
        <strong>{clinicName}</strong>
        <span className="text-[var(--oe-nc-text-muted)] text-sm ms-2">Wall display</span>
      </div>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        {lastUpdated && (
          <span className="text-sm text-[var(--oe-nc-text-muted)]">
            Updated {formatClockTime(lastUpdated)}
          </span>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
        <Button
          type="button"
          size="sm"
          variant={privacyMode ? 'secondary' : 'outline'}
          aria-pressed={privacyMode}
          onClick={() => onPrivacyModeChange(!privacyMode)}
        >
          {privacyMode ? 'Privacy on' : 'Privacy off'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => { void onToggleFullscreen(); }}
        >
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </Button>
      </div>
    </div>
  );
}
