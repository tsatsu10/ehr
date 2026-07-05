/**
 * DoctorActivePane — left column: patient banner, shortcuts, complete consult.
 */

import type { DoctorConsultPayload, DoctorSupervisorMeta } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { DoctorPatientBanner, type DoctorSignMeta } from './DoctorPatientBanner';
import { ConsultShortcuts, type ShortcutKind } from './ConsultShortcuts';
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
  runShortcut: (shortcut: ShortcutKind) => void | Promise<void>;
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
  runShortcut,
  onShortcutError: _onShortcutError,
  onPrintRx,
  onSupervisorUpdated,
  onSupervisorNotice,
}: DoctorActivePaneProps) {
  if (mode === 'idle') {
    return (
      <div id="nc-doctor-active-pane">
        <Card>
          <CardContent className="text-[var(--oe-nc-text-muted)] text-center py-5">
            <em>Pick a patient from the queue to start a consult.</em>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div id="nc-doctor-active-pane">
        <Card>
          <CardContent><em>Loading consult…</em></CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'error' || !payload || !signMeta) {
    return (
      <div id="nc-doctor-active-pane">
        <div className={deskCalloutClass('error', 'm-0 text-sm')} role="alert">
          Failed to load consult.
        </div>
      </div>
    );
  }

  const { visit, preview } = payload;
  const completeDisabled =
    blocked || (signMeta.require_esign_before_complete_consult && !signMeta.encounter_signed);

  return (
    <div id="nc-doctor-active-pane">
      <Card>
        <CardContent>
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
            blocked={blocked}
            clinicalDocHubEnabled={!!payload.clinical_doc_hub_enabled}
            onOpenDocFavorites={onOpenDocFavorites}
            labPanelOrderEnabled={labPanelOrderEnabled}
            formularyRxEnabled={formularyRxEnabled}
            onOpenLabPanel={onOpenLabPanel}
            onOpenFormularyRx={onOpenFormularyRx}
            runShortcut={runShortcut}
          />
          {(payload.pharm_ops_enabled || payload.rx_print_enabled) ? (
            <div className="mb-3" id="nc-doctor-rx-stock-panel">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h5 className="mb-0">
                  {payload.pharm_ops_enabled ? 'Prescriptions (stock)' : 'Prescriptions'}
                </h5>
                {payload.rx_list_url ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={payload.rx_list_url} target="_blank" rel="noopener noreferrer">
                      Open Rx list
                    </a>
                  </Button>
                ) : null}
              </div>
              {payload.pharm_ops_enabled ? (
                <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              id="nc-doctor-complete-btn"
              variant="cta"
              disabled={completeDisabled}
              title={
                completeDisabled && signMeta.require_esign_before_complete_consult && !signMeta.encounter_signed
                  ? 'Sign documentation in the encounter first'
                  : undefined
              }
              onClick={onComplete}
            >
              Complete consult
            </Button>
            {visitBoardUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={visitBoardUrl} target="_top">
                  View on Visit Board
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
