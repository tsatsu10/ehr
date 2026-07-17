/**
 * DoctorActivePane — active consult workspace: banner, shortcuts, complete.
 */

import type { DoctorConsultPayload, DoctorSupervisorMeta } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { t } from '@core/i18n';
import { DoctorPatientBanner, type DoctorSignMeta } from './DoctorPatientBanner';
import { ConsultShortcuts, type ShortcutKind } from './ConsultShortcuts';
import { SupervisorCombobox } from './SupervisorCombobox';
import { PharmacyPrescriptionsTable } from '../pharmacy-desk/PharmacyPrescriptionsTable';
import {
  DoctorActiveEmpty,
  DoctorActiveLoading,
  DoctorActiveSection,
  DoctorActiveShell,
  DoctorActiveStickyFooter,
} from './doctorDeskUi';

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
  onOpenPatientEducation?: () => void;
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
  onOpenPatientEducation,
  runShortcut,
  onShortcutError: _onShortcutError,
  onPrintRx,
  onSupervisorUpdated,
  onSupervisorNotice,
}: DoctorActivePaneProps) {
  if (mode === 'idle') {
    return <DoctorActiveEmpty />;
  }

  if (mode === 'loading') {
    return <DoctorActiveLoading />;
  }

  if (mode === 'error' || !payload || !signMeta) {
    return (
      <DoctorActiveShell>
        <div className="nc-doctor-active-shell__content">
          <div className={deskCalloutClass('error', 'm-0 text-sm')} role="alert">
            {t('Failed to load consult.')}
          </div>
        </div>
      </DoctorActiveShell>
    );
  }

  const { visit, preview } = payload;
  const completeDisabled =
    blocked || (signMeta.require_esign_before_complete_consult && !signMeta.encounter_signed);

  return (
    <DoctorActiveShell className="nc-doctor-active-shell--with-sticky-footer">
      <header className="nc-doctor-active-shell__hero">
        <h2 className="nc-doctor-active-shell__hero-title">
          {t('Active consult · #{queueNumber} {name}', {
            queueNumber: visit.queue_number,
            name: preview.identity.display_name,
          })}
        </h2>
        <p className="nc-doctor-active-shell__hero-sub">
          {visit.visit_type_label || t('Visit')}
          {visit.chief_complaint ? ` — ${visit.chief_complaint}` : ''}
        </p>
      </header>

      <div className="nc-doctor-active-shell__content">
        <DoctorPatientBanner preview={preview} visit={visit} signMeta={signMeta} slim />

        <DoctorActiveSection>
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
        </DoctorActiveSection>

        <DoctorActiveSection title="Clinical actions">
          <ConsultShortcuts
            blocked={blocked}
            clinicalDocHubEnabled={!!payload.clinical_doc_hub_enabled}
            onOpenDocFavorites={onOpenDocFavorites}
            onOpenPatientEducation={onOpenPatientEducation}
            labPanelOrderEnabled={labPanelOrderEnabled}
            formularyRxEnabled={formularyRxEnabled}
            onOpenLabPanel={onOpenLabPanel}
            onOpenFormularyRx={onOpenFormularyRx}
            runShortcut={runShortcut}
          />
        </DoctorActiveSection>

        {(payload.pharm_ops_enabled || payload.rx_print_enabled) && (
          <DoctorActiveSection
            title={payload.pharm_ops_enabled ? t('Prescriptions (stock)') : t('Prescriptions')}
            description={
              payload.pharm_ops_enabled
                ? t('Quantity on hand is read-only when Pharmacy Operations is enabled.')
                : undefined
            }
          >
            <div id="nc-doctor-rx-stock-panel">
              {payload.rx_list_url ? (
                <div className="mb-2 flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <a href={payload.rx_list_url} target="_blank" rel="noopener noreferrer">
                      {payload.rx_list_url.includes('rx-history.php') ? t('Rx history') : t('Open Rx list')}
                    </a>
                  </Button>
                </div>
              ) : null}
              <PharmacyPrescriptionsTable
                prescriptions={payload.prescriptions ?? []}
                showStockBadges={!!payload.pharm_ops_enabled}
                canPrintRx={!!payload.can_print_rx}
                onPrintRx={onPrintRx}
              />
            </div>
          </DoctorActiveSection>
        )}
      </div>

      <DoctorActiveStickyFooter>
        <Button
          type="button"
          id="nc-doctor-complete-btn"
          variant="cta"
          disabled={completeDisabled}
          title={
            completeDisabled && signMeta.require_esign_before_complete_consult && !signMeta.encounter_signed
              ? t('Sign documentation in the encounter first')
              : undefined
          }
          onClick={onComplete}
        >
          {t('Complete consult')}
        </Button>
        {visitBoardUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={visitBoardUrl} target="_top">
              {t('View on Visit Board')}
            </a>
          </Button>
        )}
      </DoctorActiveStickyFooter>
    </DoctorActiveShell>
  );
}
