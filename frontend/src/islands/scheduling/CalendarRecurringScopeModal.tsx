import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import '@components/ui/ui-primitives.css';
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
        className="oe-nc-recurr-scope-modal"
        aria-labelledby="nc-recurr-scope-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-recurr-scope-title">
            {labels.recurringScopeTitle}
          </DialogTitle>
          <DialogClose className="oe-nc-dialog__close" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <div className="oe-nc-dialog__body">
          <p className="mb-3">{labels.recurringScopePrompt}</p>
          <div className="d-flex flex-column">
            <button
              type="button"
              className="btn btn-outline-primary mb-2 text-left"
              onClick={() => onSelect('current')}
            >
              {labels.recurringScopeCurrent}
            </button>
            <button
              type="button"
              className="btn btn-outline-primary mb-2 text-left"
              onClick={() => onSelect('future')}
            >
              {labels.recurringScopeFuture}
            </button>
            <button
              type="button"
              className="btn btn-outline-primary text-left"
              onClick={() => onSelect('all')}
            >
              {labels.recurringScopeAll}
            </button>
          </div>
        </div>
        <DialogFooter>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {labels.cancel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
