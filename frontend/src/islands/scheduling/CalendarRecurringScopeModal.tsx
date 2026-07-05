import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import type { SchedulingLabels } from './schedulingTypes';

export type RecurringEditScope = 'current' | 'future' | 'all';

interface CalendarRecurringScopeModalProps {
  open: boolean;
  labels: SchedulingLabels;
  onSelect: (scope: RecurringEditScope) => void;
  onCancel: () => void;
}

export function CalendarRecurringScopeModal({
  open,
  labels,
  onSelect,
  onCancel,
}: CalendarRecurringScopeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent
        className="nc-recurr-scope-modal"
        aria-labelledby="nc-recurr-scope-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-recurr-scope-title">
            {labels.recurringScopeTitle}
          </DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          <p className="mb-3">{labels.recurringScopePrompt}</p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start w-full"
              onClick={() => onSelect('current')}
            >
              {labels.recurringScopeCurrent}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start w-full"
              onClick={() => onSelect('future')}
            >
              {labels.recurringScopeFuture}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start w-full"
              onClick={() => onSelect('all')}
            >
              {labels.recurringScopeAll}
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {labels.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
