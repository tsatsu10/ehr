import type { DeskInterrupt } from '@core/deskConflict';

interface DeskInterruptBannerProps {
  interrupt: DeskInterrupt | null;
  onDismiss: () => void;
}

export function DeskInterruptBanner({ interrupt, onDismiss }: DeskInterruptBannerProps) {
  if (!interrupt) return null;

  const variant = interrupt.type === 'stale_visit' ? 'warning' : 'danger';

  return (
    <div className={`alert alert-${variant} d-flex justify-content-between align-items-start mb-3`} role="alert">
      <span>{interrupt.message}</span>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary ml-2 flex-shrink-0"
        onClick={onDismiss}
      >
        Return to queue
      </button>
    </div>
  );
}
