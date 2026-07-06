import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';

interface EncounterUnlockDialogProps {
  open: boolean;
  unlocking: boolean;
  reason: string;
  password: string;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onReasonChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirm: () => void;
}

export function EncounterUnlockDialog({
  open,
  unlocking,
  reason,
  password,
  error,
  onOpenChange,
  onReasonChange,
  onPasswordChange,
  onConfirm,
}: EncounterUnlockDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock consult note for correction</DialogTitle>
          <DialogDescription>
            This removes the E-Sign lock so the note can be edited and re-signed. Use only for manager-approved clinical corrections.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="encounter-unlock-reason">Correction reason</Label>
            <Textarea
              id="encounter-unlock-reason"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="encounter-unlock-password">Password</Label>
            <Input
              id="encounter-unlock-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={unlocking || reason.trim() === '' || password.trim() === ''}
          >
            Unlock note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
