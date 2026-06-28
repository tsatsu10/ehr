import { useEffect, useState } from 'react';
import { useModalDismiss } from '@components/useModalDismiss';
import type {
  CalendarCategory,
  FeeScheduleRow,
  VisitTypeRow,
} from '../adminTypes';

interface VisitTypeModalProps {
  open: boolean;
  row: VisitTypeRow | null;
  calendarCategories: CalendarCategory[];
  feeSchedule: FeeScheduleRow[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: {
    id: number;
    label: string;
    pc_catid: number;
    service_profile: string;
    referral_required: boolean;
    is_default: boolean;
    cashier_fee_hint_ids: number[];
  }) => void;
}

export function VisitTypeModal({
  open,
  row,
  calendarCategories,
  feeSchedule,
  saving,
  error,
  onClose,
  onSave,
}: VisitTypeModalProps) {
  const [label, setLabel] = useState('');
  const [pcCatid, setPcCatid] = useState(0);
  const [serviceProfile, setServiceProfile] = useState('full_opd');
  const [referralRequired, setReferralRequired] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [feeHintIds, setFeeHintIds] = useState<number[]>([]);

  useModalDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;
    setLabel(row?.label ?? '');
    setPcCatid(row?.pc_catid ?? Number(calendarCategories[0]?.pc_catid ?? 0));
    setServiceProfile(row?.service_profile ?? 'full_opd');
    setReferralRequired(Boolean(row?.referral_required));
    setIsDefault(Boolean(row?.is_default));
    setFeeHintIds(row?.cashier_fee_hint_ids ?? []);
  }, [open, row, calendarCategories]);

  const activeFees = feeSchedule.filter((f) => f.is_active !== false);

  if (!open) return null;

  return (
    <>
      <div
        className="modal fade show d-block"
        id="nc-admin-visit-type-modal"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="nc-admin-visit-type-title"
        aria-modal="true"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="nc-admin-visit-type-title">
                {row ? 'Edit visit type' : 'Add visit type'}
              </h5>
              <button
                type="button"
                className="btn btn-link close"
                id="nc-admin-visit-type-close"
                aria-label="Close"
                onClick={onClose}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <input type="hidden" id="nc-admin-visit-type-id" value={row?.id ?? ''} />
              <div className="form-group">
                <label htmlFor="nc-admin-visit-type-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="nc-admin-visit-type-label"
                  maxLength={128}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="nc-admin-visit-type-category">Calendar category</label>
                <select
                  className="form-control"
                  id="nc-admin-visit-type-category"
                  value={pcCatid}
                  onChange={(e) => setPcCatid(Number.parseInt(e.target.value, 10))}
                >
                  {calendarCategories.map((cat) => (
                    <option key={cat.pc_catid} value={cat.pc_catid}>
                      {cat.name} ({cat.pc_catid})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="nc-admin-visit-type-profile">Service profile</label>
                <select
                  className="form-control"
                  id="nc-admin-visit-type-profile"
                  value={serviceProfile}
                  onChange={(e) => setServiceProfile(e.target.value)}
                >
                  <option value="full_opd">Full OPD</option>
                  <option value="lab_direct">Lab direct</option>
                  <option value="pharmacy_walkin">Pharmacy walk-in</option>
                </select>
              </div>
              <div className="form-group form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="nc-admin-visit-type-referral"
                  checked={referralRequired}
                  onChange={(e) => setReferralRequired(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="nc-admin-visit-type-referral">
                  Referral required
                </label>
              </div>
              <div className="form-group form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="nc-admin-visit-type-default"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="nc-admin-visit-type-default">
                  Default for Front Desk
                </label>
              </div>
              <div className="form-group">
                <label htmlFor="nc-admin-visit-type-fee-hints">Suggested cashier fees</label>
                <select
                  className="form-control"
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
                </select>
                <small className="form-text text-muted">
                  Pre-selects fee lines when a visit reaches cashier (hold Ctrl to select multiple).
                </small>
              </div>
              {error && (
                <div className="alert alert-danger" id="nc-admin-visit-type-error">{error}</div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                id="nc-admin-visit-type-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                id="nc-admin-visit-type-save"
                disabled={saving || label.trim() === ''}
                onClick={() => onSave({
                  id: row?.id ?? 0,
                  label: label.trim(),
                  pc_catid: pcCatid,
                  service_profile: serviceProfile,
                  referral_required: referralRequired,
                  is_default: isDefault,
                  cashier_fee_hint_ids: feeHintIds,
                })}
              >
                {saving ? 'Saving…' : 'Save visit type'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" id="nc-admin-modal-backdrop" />
    </>
  );
}
