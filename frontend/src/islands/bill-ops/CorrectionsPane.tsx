import { useEffect, useMemo, useState } from 'react';
import { ChargeCorrectionForm } from './ChargeCorrectionForm';
import { CorrectionDrawer } from './CorrectionDrawer';
import type { BillOpsHubProps } from './billOpsTypes';

function visitIdFromUrl(): number | null {
  const raw = new URL(window.location.href).searchParams.get('visit_id');
  if (!raw) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

export function CorrectionsPaneWrapper(props: BillOpsHubProps) {
  const fetchOptions = useMemo(
    () => ({ ajaxUrl: props.ajaxUrl, csrfToken: props.csrfToken }),
    [props.ajaxUrl, props.csrfToken],
  );
  const [drawerVisitId, setDrawerVisitId] = useState<number | null>(() => visitIdFromUrl());

  useEffect(() => {
    setDrawerVisitId(visitIdFromUrl());
  }, []);

  const closeDrawer = () => {
    setDrawerVisitId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('visit_id');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="nc-billops-pane">
      <ChargeCorrectionForm fetchOptions={fetchOptions} visitId={null} showVisitLookup />
      <CorrectionDrawer
        open={drawerVisitId !== null}
        visitId={drawerVisitId}
        fetchOptions={fetchOptions}
        onClose={closeDrawer}
      />
    </div>
  );
}
