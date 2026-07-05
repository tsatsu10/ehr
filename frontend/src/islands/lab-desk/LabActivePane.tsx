import type { LabSelectData } from '@core/types';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { LabOrdersTable } from './LabOrdersTable';
import { LabDirectPanel } from './LabDirectPanel';

export type LabActiveMode = 'idle' | 'loading' | 'active' | 'error';

interface LabActivePaneProps {
  mode: LabActiveMode;
  data: LabSelectData | null;
  hasActiveWork: boolean;
  labOpsEnabled?: boolean;
  canSkipToPayment?: boolean;
  visitBoardUrl?: string;
  blocked: boolean;
  actionError: string | null;
  submitting: boolean;
  onTakePatient: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onOpenOrders: () => void;
  onOpenResults: (orderId?: number) => void;
  onOpenLabIntake?: () => void;
  onCreateLabOrder?: () => void;
}

function PatientBanner({ data }: { data: LabSelectData }) {
  const { preview, visit } = data;

  return (
    <>
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
          <AncillaryVisitBadges badges={visit.ancillary_badges} className="ml-1" />
        </div>
      </PatientContextBanner>
      {data.critical_unreleased && (
        <div className={deskCalloutClass('error', 'mb-3 text-sm')} role="alert">
          Critical result saved but not released to doctor. Release from Enter results.
        </div>
      )}
    </>
  );
}

export function LabActivePane({
  mode,
  data,
  hasActiveWork,
  labOpsEnabled = false,
  canSkipToPayment = false,
  visitBoardUrl,
  blocked,
  actionError,
  submitting,
  onTakePatient,
  onComplete,
  onSkip,
  onOpenOrders,
  onOpenResults,
  onOpenLabIntake,
  onCreateLabOrder,
}: LabActivePaneProps) {
  if (mode === 'idle') {
    return (
      <div id="nc-lab-active-pane">
        <Card>
          <CardContent className="text-[var(--oe-nc-text-muted)] text-center py-5">
            <em>Select a patient from the lab queue.</em>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div id="nc-lab-active-pane">
        <Card>
          <CardContent><em>Loading…</em></CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'error' || !data) {
    return (
      <div id="nc-lab-active-pane">
        <div className={deskCalloutClass('error', 'm-0 text-sm')} role="alert">
          Failed to load visit.
        </div>
      </div>
    );
  }

  const inLab = data.visit.state === 'in_lab';
  const canTake = data.visit.state === 'ready_for_lab' && !hasActiveWork;
  const canSkip = canSkipToPayment && (data.visit.state === 'ready_for_lab' || inLab);
  const resultsLabel = labOpsEnabled ? 'Enter results (hub)' : 'Open results (core)';
  const labDirectIntake = data.lab_direct_intake;
  const showCoreOrdersButton = !labDirectIntake?.enabled || !labDirectIntake.can_create_orders;

  return (
    <div id="nc-lab-active-pane">
      <Card>
        <CardContent>
          <PatientBanner data={data} />

          {labDirectIntake?.enabled && onOpenLabIntake && onCreateLabOrder && (
            <LabDirectPanel
              intake={labDirectIntake}
              inLab={inLab}
              disabled={blocked || submitting}
              onOpenLabIntake={onOpenLabIntake}
              onCreateOrder={onCreateLabOrder}
            />
          )}

          <h5>Lab orders</h5>
          <LabOrdersTable
            orders={data.lab_orders ?? []}
            labOpsEnabled={labOpsEnabled}
            inLab={inLab}
            onEnterResults={(orderId) => onOpenResults(orderId)}
          />

          <div className="mb-3 mt-3 flex flex-wrap gap-2">
            {showCoreOrdersButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                id="nc-lab-open-orders"
                disabled={blocked || !inLab}
                onClick={onOpenOrders}
              >
                Open orders (core)
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              id={labOpsEnabled ? 'nc-lab-enter-results-primary' : 'nc-lab-open-results'}
              disabled={blocked || !inLab}
              onClick={() => onOpenResults(data.lab_orders[0]?.id)}
            >
              {resultsLabel}
            </Button>
          </div>

          {actionError && (
            <div className={deskCalloutClass('error', 'text-sm')} id="nc-lab-action-error" role="alert">
              {actionError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canTake && (
              <Button
                type="button"
                id="nc-lab-take-btn"
                disabled={blocked || submitting}
                onClick={onTakePatient}
              >
                Take patient
              </Button>
            )}
            {inLab && (
              <Button
                type="button"
                variant="cta"
                id="nc-lab-complete-btn"
                disabled={blocked || submitting}
                onClick={onComplete}
              >
                {submitting ? 'Completing…' : 'Lab complete'}
              </Button>
            )}
            {canSkip && (
              <Button
                type="button"
                variant="outline"
                className="border-amber-400 text-amber-800 hover:bg-amber-50"
                id="nc-lab-skip-btn"
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
