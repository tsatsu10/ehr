/**
 * DoctorActivePane — left column: patient banner, shortcuts, complete consult.
 */

import type { DoctorConsultPayload, DoctorSupervisorMeta } from '@core/types';
import { DoctorPatientBanner, type DoctorSignMeta } from './DoctorPatientBanner';
import { ConsultShortcuts } from './ConsultShortcuts';
import { SupervisorCombobox } from './SupervisorCombobox';
import { PharmacyPrescriptionsTable } from '../pharmacy-desk/PharmacyPrescriptionsTable';

export type ActiveMode = 'idle' | 'loading' | 'consult' | 'error';

interface DoctorActivePaneProps {
  mode: ActiveMode;
  payload: DoctorConsultPayload | null;
  signMeta: DoctorSignMeta | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  visitBoardUrl?: string;
  blocked: boolean;
  labPanelOrderEnabled?: boolean;
  formularyRxEnabled?: boolean;
  onComplete: () => void;
  onOpenLabPanel: () => void;
  onOpenFormularyRx: () => void;
  onOpenDocFavorites?: () => void;
  onShortcutError: (message: string) => void;
  onPrintRx?: (prescriptionId: number) => void;
  onSupervisorUpdated: (meta: DoctorSupervisorMeta) => void;
  onSupervisorNotice: (message: string, variant: 'success' | 'danger') => void;
}

export function DoctorActivePane({
  mode,
  payload,
  signMeta,
  ajaxUrl,
  csrfToken,
  facilityId,
  visitBoardUrl,
  blocked,
  labPanelOrderEnabled,
  formularyRxEnabled,
  onComplete,
  onOpenLabPanel,
  onOpenFormularyRx,
  onOpenDocFavorites,
  onShortcutError,
  onPrintRx,
  onSupervisorUpdated,
  onSupervisorNotice,
}: DoctorActivePaneProps) {
  if (mode === 'idle') {
    return (
      <div id="nc-doctor-active-pane">
        <div className="card">
          <div className="card-body text-muted text-center py-5">
            <em>Pick a patient from the queue to start a consult.</em>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div id="nc-doctor-active-pane">
        <div className="card">
          <div className="card-body">
            <em>Loading consult…</em>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'error' || !payload || !signMeta) {
    return (
      <div id="nc-doctor-active-pane">
        <div className="alert alert-danger m-0">Failed to load consult.</div>
      </div>
    );
  }

  const { visit, preview } = payload;
  const completeDisabled =
    blocked || (signMeta.require_esign_before_complete_consult && !signMeta.encounter_signed);

  return (
    <div id="nc-doctor-active-pane">
      <div className="card">
        <div className="card-body">
          <DoctorPatientBanner preview={preview} visit={visit} signMeta={signMeta} />
          <SupervisorCombobox
            visit={visit}
            supervisor={{
              supervisor_id: signMeta.supervisor_id,
              supervisor_display_name: signMeta.supervisor_display_name,
              supervisor_from_profile: signMeta.supervisor_from_profile,
            }}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            facilityId={facilityId}
            blocked={blocked}
            onUpdated={onSupervisorUpdated}
            onNotice={onSupervisorNotice}
          />
          <ConsultShortcuts
            visit={visit}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            blocked={blocked}
            clinicalDocHubEnabled={!!payload.clinical_doc_hub_enabled}
            onOpenDocFavorites={onOpenDocFavorites}
            labPanelOrderEnabled={labPanelOrderEnabled}
            formularyRxEnabled={formularyRxEnabled}
            onOpenLabPanel={onOpenLabPanel}
            onOpenFormularyRx={onOpenFormularyRx}
            onError={onShortcutError}
          />
          {(payload.pharm_ops_enabled || payload.rx_print_enabled) ? (
            <div className="mb-3" id="nc-doctor-rx-stock-panel">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">
                  {payload.pharm_ops_enabled ? 'Prescriptions (stock)' : 'Prescriptions'}
                </h5>
                {payload.rx_list_url ? (
                  <a
                    className="btn btn-outline-secondary btn-sm"
                    href={payload.rx_list_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Rx list
                  </a>
                ) : null}
              </div>
              {payload.pharm_ops_enabled ? (
                <p className="small text-muted mb-2">
                  Read-only quantity on hand when Pharmacy Operations is enabled.
                </p>
              ) : null}
              <PharmacyPrescriptionsTable
                prescriptions={payload.prescriptions ?? []}
                showStockBadges={!!payload.pharm_ops_enabled}
                canPrintRx={!!payload.can_print_rx}
                onPrintRx={onPrintRx}
              />
            </div>
          ) : null}
          <div className="d-flex flex-wrap align-items-center">
            <button
              type="button"
              id="nc-doctor-complete-btn"
              className="btn btn-success mr-2"
              disabled={completeDisabled}
              title={
                completeDisabled && signMeta.require_esign_before_complete_consult && !signMeta.encounter_signed
                  ? 'Sign documentation in the encounter first'
                  : undefined
              }
              onClick={onComplete}
            >
              Complete consult
            </button>
            {visitBoardUrl && (
              <a className="btn btn-outline-secondary btn-sm" href={visitBoardUrl} target="_top">
                View on Visit Board
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
