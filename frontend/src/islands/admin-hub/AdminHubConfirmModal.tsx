import { ConfirmModal } from '@components/ConfirmModal';
import type { AdminConfirm } from './adminHubConfirm';

export interface AdminHubConfirmModalProps {
  pendingConfirm: AdminConfirm | null;
  onClose: () => void;
  onConfirm: (confirm: AdminConfirm) => void;
}

export function AdminHubConfirmModal({
  pendingConfirm,
  onClose,
  onConfirm,
}: AdminHubConfirmModalProps) {
  return (
    <ConfirmModal
      open={!!pendingConfirm}
      onClose={onClose}
      title={
        pendingConfirm?.type === 'scope_switch' ? 'Switch settings scope?'
          : pendingConfirm?.type === 'archive_visit_type' ? 'Archive visit type?'
            : pendingConfirm?.type === 'archive_fee' ? 'Archive fee line?'
              : pendingConfirm?.type === 'grant_roles' ? 'Grant desk roles?'
                : pendingConfirm?.type === 'catalog_enable' ? 'Enable billing form?'
                  : 'Apply cash clinic profile?'
      }
      modalId="nc-admin-confirm-modal"
      cancelLabel="Cancel"
      confirmLabel={
        pendingConfirm?.type === 'scope_switch' ? 'Switch'
          : pendingConfirm?.type === 'grant_roles' ? 'Grant roles'
            : pendingConfirm?.type === 'cash_profile' ? 'Apply profile'
              : pendingConfirm?.type === 'catalog_enable' ? 'Enable anyway'
                : 'Archive'
      }
      confirmVariant={
        pendingConfirm?.type === 'archive_visit_type' || pendingConfirm?.type === 'archive_fee'
          ? 'danger'
          : 'warning'
      }
      onConfirm={() => {
        if (!pendingConfirm) return;
        onConfirm(pendingConfirm);
      }}
    >
      {pendingConfirm?.type === 'scope_switch' && (
        <p className="mb-0">Discard unsaved changes and switch settings scope?</p>
      )}
      {pendingConfirm?.type === 'archive_visit_type' && (
        <p className="mb-0">Archive visit type &quot;{pendingConfirm.row.label}&quot;?</p>
      )}
      {pendingConfirm?.type === 'archive_fee' && (
        <p className="mb-0">Archive fee line &quot;{pendingConfirm.row.name}&quot;?</p>
      )}
      {pendingConfirm?.type === 'grant_roles' && (
        <p className="mb-0">
          Grant all New Clinic desk groups to your account? Log out and back in afterward.
        </p>
      )}
      {pendingConfirm?.type === 'cash_profile' && (
        <p className="mb-0">
          Apply the cash clinic profile? This updates OpenEMR globals (E-Sign, currency symbol,
          eligibility, search UI) and enables pinned reception preview. Changes are logged.
        </p>
      )}
      {pendingConfirm?.type === 'catalog_enable' && (
        <p className="mb-0">{pendingConfirm.item.enable_warning}</p>
      )}
    </ConfirmModal>
  );
}
