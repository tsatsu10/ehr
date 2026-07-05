import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import type { DeskInterrupt } from '@core/deskConflict';
import type { DeskCalloutTone } from '@components/deskCalloutStyles';

interface DeskInterruptBannerProps {
  interrupt: DeskInterrupt | null;
  onDismiss: () => void;
}

function interruptTone(type: DeskInterrupt['type']): DeskCalloutTone {
  return type === 'stale_visit' ? 'warn' : 'error';
}

export function DeskInterruptBanner({ interrupt, onDismiss }: DeskInterruptBannerProps) {
  if (!interrupt) return null;

  return (
    <div
      className={deskCalloutClass(interruptTone(interrupt.type), 'flex justify-between items-start mb-3')}
      role="alert"
    >
      <span>{interrupt.message}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ml-2 flex-shrink-0"
        onClick={onDismiss}
      >
        Return to queue
      </Button>
    </div>
  );
}
