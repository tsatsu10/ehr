import { ChargeCorrectionForm } from './ChargeCorrectionForm';

interface Props {
  open: boolean;
  visitId: number | null;
  fetchOptions: { ajaxUrl: string; csrfToken: string };
  onClose: () => void;
}

export function CorrectionDrawer({ open, visitId, fetchOptions, onClose }: Props) {
  if (!open || !visitId) return null;

  return (
    <>
      <div
        className="oe-nc-billops-drawer-backdrop"
        aria-hidden="true"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        role="presentation"
      />
      <aside
        className="oe-nc-billops-drawer"
        aria-labelledby="nc-billops-drawer-title"
        role="dialog"
        aria-modal="true"
      >
        <header className="oe-nc-billops-drawer__header">
          <h2 className="h6 mb-0" id="nc-billops-drawer-title">
            Charge correction — Visit #{visitId}
          </h2>
          <button type="button" className="close" aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">&times;</span>
          </button>
        </header>
        <div className="oe-nc-billops-drawer__body">
          <ChargeCorrectionForm
            fetchOptions={fetchOptions}
            visitId={visitId}
            autoLoad
            onSaved={onClose}
          />
        </div>
      </aside>
    </>
  );
}
