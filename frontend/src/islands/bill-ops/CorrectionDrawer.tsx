import { ChargeCorrectionForm } from './ChargeCorrectionForm';
import { SlideOver } from '@components/SlideOver';

interface Props {
  open: boolean;
  visitId: number | null;
  fetchOptions: { ajaxUrl: string; csrfToken: string };
  onClose: () => void;
}

export function CorrectionDrawer({ open, visitId, fetchOptions, onClose }: Props) {
  if (!visitId) return null;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={`Charge correction — Visit #${visitId}`}
      titleId="nc-billops-drawer-title"
      id="nc-billops-drawer"
      width="md"
    >
      <ChargeCorrectionForm
        fetchOptions={fetchOptions}
        visitId={visitId}
        autoLoad
        onSaved={onClose}
      />
    </SlideOver>
  );
}
