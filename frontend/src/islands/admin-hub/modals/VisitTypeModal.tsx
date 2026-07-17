import { useEffect, useState } from 'react';
import { useModalDismiss } from '@components/useModalDismiss';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';
import { Label } from '@components/ui/label';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import type {
  FeeScheduleRow,
  VisitTypeRow,
} from '../adminTypes';

interface VisitTypeModalProps {
  open: boolean;
  row: VisitTypeRow | null;
  feeSchedule: FeeScheduleRow[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: {
    id: number;
    label: string;
    service_profile: string;
    referral_required: boolean;
    is_default: boolean;
    cashier_fee_hint_ids: number[];
  }) => void;
}

export function VisitTypeModal({
  open,
  row,
  feeSchedule,
  saving,
  error,
  onClose,
  onSave,
}: VisitTypeModalProps) {
  const [label, setLabel] = useState('');
  const [serviceProfile, setServiceProfile] = useState('full_opd');
  const [referralRequired, setReferralRequired] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [feeHintIds, setFeeHintIds] = useState<number[]>([]);

  useModalDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;
    setLabel(row?.label ?? '');
    setServiceProfile(row?.service_profile ?? 'full_opd');
    setReferralRequired(Boolean(row?.referral_required));
    setIsDefault(Boolean(row?.is_default));
    setFeeHintIds(row?.cashier_fee_hint_ids ?? []);
  }, [open, row]);

  const activeFees = feeSchedule.filter((f) => f.is_active !== false);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-admin-visit-type-modal"
        className={dialogContentSizeClass.lg}
        aria-labelledby="nc-admin-visit-type-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-admin-visit-type-title">
            {row ? 'Edit visit type' : 'Add visit type'}
          </DialogTitle>
          <DialogClose
            id="nc-admin-visit-type-close"
            aria-label="Close"
          >
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
              <input type="hidden" id="nc-admin-visit-type-id" value={row?.id ?? ''} />
              <div className="space-y-1.5 mb-3">
                <Label htmlFor="nc-admin-visit-type-label">Name</Label>
                <Input
                  type="text"
                  id="nc-admin-visit-type-label"
                  maxLength={128}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 mb-3">
                <Label htmlFor="nc-admin-visit-type-profile">Service profile</Label>
                <Select value={serviceProfile} onValueChange={setServiceProfile}>
                  <SelectTrigger id="nc-admin-visit-type-profile">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_opd">Full OPD</SelectItem>
                    <SelectItem value="lab_direct">Lab direct</SelectItem>
                    <SelectItem value="pharmacy_walkin">Pharmacy walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="nc-admin-visit-type-referral"
                  checked={referralRequired}
                  onCheckedChange={(checked) => setReferralRequired(checked === true)}
                />
                <Label htmlFor="nc-admin-visit-type-referral" className="font-normal cursor-pointer">
                  Referral required
                </Label>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="nc-admin-visit-type-default"
                  checked={isDefault}
                  onCheckedChange={(checked) => setIsDefault(checked === true)}
                />
                <Label htmlFor="nc-admin-visit-type-default" className="font-normal cursor-pointer">
                  Default for Front Desk
                </Label>
              </div>
              <div className="space-y-1.5 mb-3">
                <Label htmlFor="nc-admin-visit-type-fee-hints">Suggested cashier fees</Label>
                <NativeSelect
                  id="nc-admin-visit-type-fee-hints"
                  multiple
                  size={5}
                  value={feeHintIds.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((opt) =>
                      Number.parseInt(opt.value, 10)
                    );
                    setFeeHintIds(selected);
                  }}
                >
                  {activeFees.map((fee) => (
                    <option key={fee.id} value={fee.id}>
                      {fee.name} ({fee.code})
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-[var(--oe-nc-text-muted)] m-0">
                  Pre-selects fee lines when a visit reaches cashier (hold Ctrl to select multiple).
                </p>
              </div>
              {error && (
                <div className={deskCalloutClass('error', 'text-sm')} id="nc-admin-visit-type-error" role="alert">
                  {error}
                </div>
              )}
            </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            id="nc-admin-visit-type-cancel"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            id="nc-admin-visit-type-save"
            disabled={saving || label.trim() === ''}
            onClick={() => onSave({
              id: row?.id ?? 0,
              label: label.trim(),
              service_profile: serviceProfile,
              referral_required: referralRequired,
              is_default: isDefault,
              cashier_fee_hint_ids: feeHintIds,
            })}
          >
            {saving ? 'Saving…' : 'Save visit type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
