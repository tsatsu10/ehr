import type { PharmacySelectData } from '@core/types';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { PharmacyPrescriptionsTable } from './PharmacyPrescriptionsTable';
import { PharmacyWalkinPanel } from './PharmacyWalkinPanel';
import { PharmacyExternalRxPanel } from './PharmacyExternalRxPanel';

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

function PatientBanner({ data }: { data: PharmacySelectData }) {
  const { preview, visit } = data;

  return (
    <PatientContextBanner
      identity={preview.identity}
      layout="compact"
      completion={preview.completion}
      safety={preview.safety}
      {...bannerPropsFromPreview(preview)}
      aside={<Badge variant="neutral">{visit.state}</Badge>}
    >
      <div className="text-sm mt-1 text-[var(--oe-nc-text-muted)]">
        Visit #{visit.queue_number} · {visit.visit_type_label || 'Visit'}
      </div>
    </PatientContextBanner>
  );
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
    return (
      <div id="nc-pharmacy-active-pane">
        <Card>
          <CardContent className="text-[var(--oe-nc-text-muted)] text-center py-5">
            <em>Select a patient from the pharmacy queue.</em>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div id="nc-pharmacy-active-pane">
        <Card>
          <CardContent><em>Loading…</em></CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'error' || !data) {
    return (
      <div id="nc-pharmacy-active-pane">
        <div className={deskCalloutClass('error', 'm-0 text-sm')} role="alert">
          Failed to load visit.
        </div>
      </div>
    );
  }

  const inPharmacy = data.visit.state === 'in_pharmacy';
  const canTake = data.visit.state === 'ready_for_pharmacy' && !hasActiveWork;
  const canSkip = canSkipToPayment && (data.visit.state === 'ready_for_pharmacy' || inPharmacy);
  const walkinTriage = data.walkin_triage;
  const needsWalkinOutcome = !!walkinTriage?.enabled;
  const completeBlocked = needsWalkinOutcome && !walkinOutcome;
  const rxListUrl = data.rx_list_url || '#';

  return (
    <div id="nc-pharmacy-active-pane">
      <Card>
        <CardContent>
          <PatientBanner data={data} />

          {walkinTriage?.enabled && onSelectWalkinOutcome && onWalkinClose && (
            <PharmacyWalkinPanel
              triage={walkinTriage}
              selectedOutcome={walkinOutcome}
              disabled={blocked || submitting}
              onSelectOutcome={onSelectWalkinOutcome}
              onCloseWithoutDispense={onWalkinClose}
            />
          )}

          {walkinOutcome === 'external_rx_dispensed'
            && walkinTriage?.external_rx
            && onOpenPharmacyService && (
            <PharmacyExternalRxPanel
              status={walkinTriage.external_rx}
              disabled={blocked || submitting}
              onOpenPharmacyService={onOpenPharmacyService}
            />
          )}

          {(data.undispensed_rx_count ?? 0) > 0 ? (
            <div className={deskCalloutClass('warn', 'mb-3 text-sm')} role="alert">
              <strong>
                {data.undispensed_rx_count === 1
                  ? '1 Rx undispensed'
                  : `${data.undispensed_rx_count} Rx undispensed`}
              </strong>
              {' '}
              — Pharmacy complete is blocked until dispensed, skipped to payment, or supervisor override.
            </div>
          ) : null}

          <h5>Prescriptions for this visit</h5>
          <PharmacyPrescriptionsTable
            prescriptions={data.prescriptions ?? []}
            showStockBadges={pharmOpsEnabled}
            canDispense={pharmOpsEnabled && canDispense}
            canPrintRx={!!data.can_print_rx}
            dispenseBlocked={blocked || !inPharmacy}
            onDispense={onDispenseRx}
            onPrintRx={onPrintRx}
          />

          <div className="mb-3 mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                id="nc-pharmacy-open-rx-list"
                href={rxListUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Rx list (core)
              </a>
            </Button>
            {pharmOpsEnabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                id="nc-pharmacy-open-dispense"
                disabled={blocked || !inPharmacy}
                onClick={onOpenDispense}
                title="Legacy stock dispense screen"
              >
                Advanced dispense (core)
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                id="nc-pharmacy-open-dispense"
                disabled={blocked || !inPharmacy}
                onClick={onOpenDispense}
              >
                Open encounter / dispense
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              id="nc-pharmacy-open-rx-edit"
              disabled={blocked || !inPharmacy}
              onClick={onOpenRxEdit}
            >
              Add Rx (core)
            </Button>
          </div>

          {actionError && (
            <div className={deskCalloutClass('error', 'text-sm')} id="nc-pharmacy-action-error" role="alert">
              {actionError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canTake && (
              <Button
                type="button"
                id="nc-pharmacy-take-btn"
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
