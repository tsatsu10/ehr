import { ConfirmModal } from '@components/ConfirmModal';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';

interface AccessionModalProps {
  open: boolean;
  accession: string;
  submitting: boolean;
  onAccessionChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function AccessionModal({
  open,
  accession,
  submitting,
  onAccessionChange,
  onConfirm,
  onClose,
}: AccessionModalProps) {
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Mark collected"
      titleId="nc-labops-accession-title"
      confirmLabel="Mark collected"
      submitting={submitting}
      onConfirm={onConfirm}
    >
      <div className="grid gap-2">
        <Label htmlFor="nc-labops-accession-input">Accession number (optional)</Label>
        <Input
          id="nc-labops-accession-input"
          type="text"
          autoComplete="off"
          value={accession}
          onChange={(e) => onAccessionChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm();
          }}
        />
      </div>
    </ConfirmModal>
  );
}
