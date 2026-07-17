import type { PharmacySelectData } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { PharmacyPrescriptionsTable } from './PharmacyPrescriptionsTable';
import { PharmacyWalkinPanel } from './PharmacyWalkinPanel';
import { PharmacyExternalRxPanel } from './PharmacyExternalRxPanel';
import { PharmacyPatientBanner } from './PharmacyPatientBanner';
import { PharmacyShortcuts } from './PharmacyShortcuts';
import {
  PharmacyActiveEmpty,
  PharmacyActiveLoading,
  PharmacyActiveSection,
  PharmacyActiveShell,
  PharmacyActiveStickyFooter,
} from './pharmacyDeskUi';

export type PharmacyActiveMode = 'idle' | 'loading' | 'active' | 'error';

interface PharmacyActivePaneProps {
  mode: PharmacyActiveMode;
  data: PharmacySelectData | null;
  hasActiveWork: boolean;
  canSkipToPayment?: boolean;
  visitBoardUrl?: string;
  blocked: boolean;
  actionError: string | null;
  submitting: boolean;
  pharmOpsEnabled?: boolean;
  canDispense?: boolean;
  onTakePatient: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onOpenDispense: () => void;
  onOpenRxEdit: () => void;
  onDispenseRx?: (prescriptionId: number) => void;
  onPrintRx?: (prescriptionId: number) => void;
  walkinOutcome?: string | null;
  onSelectWalkinOutcome?: (outcome: string) => void;
  onWalkinClose?: (outcome: string) => void;
  onOpenPharmacyService?: () => void;
}

export function PharmacyActivePane({
  mode,
  data,
  hasActiveWork,
  canSkipToPayment = false,
  visitBoardUrl,
  blocked,
  actionError,
  submitting,
  pharmOpsEnabled = false,
  canDispense = false,
  onTakePatient,
  onComplete,
  onSkip,
  onOpenDispense,
  onOpenRxEdit,
  onDispenseRx,
  onPrintRx,
  walkinOutcome = null,
  onSelectWalkinOutcome,
  onWalkinClose,
  onOpenPharmacyService,
}: PharmacyActivePaneProps) {
  if (mode === 'idle') {
    return <PharmacyActiveEmpty />;
  }

  if (mode === 'loading') {
    return <PharmacyActiveLoading />;
  }

  if (mode === 'error' || !data) {
    return (
      <PharmacyActiveShell>
        <div className="nc-pharmacy-active-shell__content">
          <div className={deskCalloutClass('error', 'm-0 text-sm')} role="alert">
            Failed to load visit.
          </div>
        </div>
      </PharmacyActiveShell>
    );
  }

  const inPharmacy = data.visit.state === 'in_pharmacy';
  const canTake = data.visit.state === 'ready_for_pharmacy' && !hasActiveWork;
  const canSkip = (canSkipToPayment || data.can_skip_to_payment)
    && (data.visit.state === 'ready_for_pharmacy' || inPharmacy);
  const walkinTriage = data.walkin_triage;
  const needsWalkinOutcome = !!walkinTriage?.enabled;
  const completeBlocked = needsWalkinOutcome && !walkinOutcome;
  const hasPrescriptions = (data.prescriptions?.length ?? 0) > 0;
  const firstUndispensedId = data.prescriptions
    ?.find((line) => line.status === 'to_dispense' || line.status === 'partial')?.id;
  const firstPrintableId = data.prescriptions?.[0]?.id;

  const heroTitle = inPharmacy
    ? `Active pharmacy · #${data.visit.queue_number} ${data.preview.identity.display_name}`
    : `Ready for pharmacy · #${data.visit.queue_number} ${data.preview.identity.display_name}`;

  const handleDispensePrimary = () => {
    if (pharmOpsEnabled && canDispense && firstUndispensedId && onDispenseRx) {
      onDispenseRx(firstUndispensedId);
      return;
    }
    // When Pharmacy Operations is on but there's nothing eligible to
    // dispense, the button is disabled (see hasDispensable below) rather
    // than falling back to the stock encounter page -- with zero
    // prescriptions there's nothing there to dispense either, so that
    // "fallback" was a dead end, not a real escape hatch. When Pharmacy
    // Operations is off there's no native path at all, so the stock page
    // stays the only option regardless of prescriptions (unchanged).
    if (!pharmOpsEnabled || hasPrescriptions) {
      onOpenDispense();
    }
  };

  const handlePrintPrimary = () => {
    if (firstPrintableId && onPrintRx) {
      onPrintRx(firstPrintableId);
    }
  };

  return (
    <PharmacyActiveShell className="nc-pharmacy-active-shell--with-sticky-footer">
      <header className="nc-pharmacy-active-shell__hero">
        <h2 className="nc-pharmacy-active-shell__hero-title">{heroTitle}</h2>
        <p className="nc-pharmacy-active-shell__hero-sub">
          {data.visit.visit_type_label || 'Visit'}
          {inPharmacy ? ' — dispense and complete' : ' — take patient to begin'}
        </p>
      </header>

      <div className="nc-pharmacy-active-shell__content">
        <PharmacyPatientBanner data={data} />

        {walkinTriage?.enabled && onSelectWalkinOutcome && onWalkinClose && (
          <PharmacyWalkinPanel
            triage={walkinTriage}
            selectedOutcome={walkinOutcome}
            disabled={blocked || submitting}
            onSelectOutcome={onSelectWalkinOutcome}
            onCloseWithoutDispense={onWalkinClose}
          />
        )}

        {walkinOutcome === 'external_rx_dispensed' && walkinTriage?.external_rx && (
          <PharmacyExternalRxPanel status={walkinTriage.external_rx} />
        )}

        <PharmacyActiveSection title="Prescriptions">
          <PharmacyPrescriptionsTable
            prescriptions={data.prescriptions ?? []}
            showStockBadges={pharmOpsEnabled}
            canDispense={pharmOpsEnabled && canDispense}
            canPrintRx={!!data.can_print_rx}
            dispenseBlocked={blocked || !inPharmacy}
            onDispense={onDispenseRx}
            onPrintRx={onPrintRx}
            onAddRx={inPharmacy && !blocked ? onOpenRxEdit : undefined}
          />
        </PharmacyActiveSection>

        <PharmacyActiveSection title="Actions">
          <PharmacyShortcuts
            blocked={blocked || submitting}
            inPharmacy={inPharmacy}
            canPrintRx={!!data.can_print_rx}
            rxListUrl={data.rx_list_url}
            showPharmacyService={
              walkinOutcome === 'external_rx_dispensed' && !!walkinTriage?.external_rx
            }
            pharmacyServiceStarted={walkinTriage?.external_rx?.pharmacy_service_started}
            hasDispensable={!pharmOpsEnabled || !!firstUndispensedId}
            hasPrintable={hasPrescriptions}
            onDispense={handleDispensePrimary}
            onAddRx={onOpenRxEdit}
            onPrintRx={data.can_print_rx ? handlePrintPrimary : undefined}
            onOpenPharmacyService={onOpenPharmacyService}
          />
        </PharmacyActiveSection>

        {actionError && (
          <div className={deskCalloutClass('error', 'text-sm')} id="nc-pharmacy-action-error" role="alert">
            {actionError}
          </div>
        )}
      </div>

      <PharmacyActiveStickyFooter>
        {canTake && (
          <Button
            type="button"
            id="nc-pharmacy-take-btn"
            variant="cta"
            disabled={blocked || submitting}
            onClick={onTakePatient}
          >
            Take patient
          </Button>
        )}
        {inPharmacy && (
          <Button
            type="button"
            variant="cta"
            id="nc-pharmacy-complete-btn"
            disabled={blocked || submitting || completeBlocked}
            title={completeBlocked ? 'Select a dispense outcome first' : undefined}
            onClick={onComplete}
          >
            {submitting ? 'Completing…' : 'Pharmacy complete'}
          </Button>
        )}
        {canSkip && (
          <Button
            type="button"
            variant="outline"
            className="border-amber-400 text-amber-800 hover:bg-amber-50"
            id="nc-pharmacy-skip-btn"
            disabled={blocked || submitting}
            onClick={onSkip}
          >
            Skip to payment
          </Button>
        )}
        {visitBoardUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={visitBoardUrl} target="_top">
              Visit Board
            </a>
          </Button>
        )}
      </PharmacyActiveStickyFooter>
    </PharmacyActiveShell>
  );
}
