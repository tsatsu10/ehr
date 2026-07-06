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

interface EncounterSignDialogProps {
  open: boolean;
  signing: boolean;
  password: string;
  amendment: string;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onPasswordChange: (value: string) => void;
  onAmendmentChange: (value: string) => void;
  onConfirm: () => void;
}

export function EncounterSignDialog({
  open,
  signing,
  password,
  amendment,
  error,
  onOpenChange,
  onPasswordChange,
  onAmendmentChange,
  onConfirm,
}: EncounterSignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign consultation note</DialogTitle>
          <DialogDescription>
            Your OpenEMR password is your electronic signature. The note will lock after signing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="encounter-sign-amendment">Signature note (optional)</Label>
            <Textarea
              id="encounter-sign-amendment"
              placeholder="Optional comment recorded with your electronic signature — not a chart correction"
              value={amendment}
              onChange={(event) => onAmendmentChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="encounter-sign-password">Password</Label>
            <Input
              id="encounter-sign-password"
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
            disabled={signing || password.trim() === ''}
          >
            Sign note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
