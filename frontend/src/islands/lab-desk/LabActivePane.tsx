import type { LabSelectData } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { LabOrdersTable } from './LabOrdersTable';
import { LabDirectPanel } from './LabDirectPanel';
import { LabPatientBanner } from './LabPatientBanner';
import { LabShortcuts } from './LabShortcuts';
import {
  LabActiveEmpty,
  LabActiveLoading,
  LabActiveSection,
  LabActiveShell,
  LabActiveStickyFooter,
} from './labDeskUi';

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
    return <LabActiveEmpty />;
  }

  if (mode === 'loading') {
    return <LabActiveLoading />;
  }

  if (mode === 'error' || !data) {
    return (
      <LabActiveShell>
        <div className="nc-lab-active-shell__content">
          <div className={deskCalloutClass('error', 'm-0 text-sm')} role="alert">
            Failed to load visit.
          </div>
        </div>
      </LabActiveShell>
    );
  }

  const inLab = data.visit.state === 'in_lab';
  const canTake = data.visit.state === 'ready_for_lab' && !hasActiveWork;
  const canSkip = (canSkipToPayment || data.can_skip_to_payment)
    && (data.visit.state === 'ready_for_lab' || inLab);
  const labDirectIntake = data.lab_direct_intake;
  const showCoreOrders = !labDirectIntake?.enabled || !labDirectIntake.can_create_orders;
  const firstOrderId = data.lab_orders[0]?.id;

  const heroTitle = inLab
    ? `Active lab work · #${data.visit.queue_number} ${data.preview.identity.display_name}`
    : `Ready for lab · #${data.visit.queue_number} ${data.preview.identity.display_name}`;

  return (
    <LabActiveShell className="nc-lab-active-shell--with-sticky-footer">
      <header className="nc-lab-active-shell__hero">
        <h2 className="nc-lab-active-shell__hero-title">{heroTitle}</h2>
        <p className="nc-lab-active-shell__hero-sub">
          {data.visit.visit_type_label || 'Visit'}
          {inLab ? ' — specimen collection & results' : ' — take patient to begin'}
        </p>
      </header>

      <div className="nc-lab-active-shell__content">
        <LabPatientBanner data={data} slim />

        {labDirectIntake?.enabled && <LabDirectPanel intake={labDirectIntake} />}

        <LabActiveSection title="Lab orders">
          <LabOrdersTable
            orders={data.lab_orders ?? []}
            labOpsEnabled={labOpsEnabled}
            inLab={inLab}
            onEnterResults={(orderId) => onOpenResults(orderId)}
          />
        </LabActiveSection>

        <LabActiveSection title="Actions">
          <LabShortcuts
            blocked={blocked || submitting}
            inLab={inLab}
            labOpsEnabled={labOpsEnabled}
            labDirectIntake={labDirectIntake}
            showCoreOrders={showCoreOrders}
            onEnterResults={() => onOpenResults(firstOrderId)}
            onOpenOrders={onOpenOrders}
            onOpenLabIntake={onOpenLabIntake}
            onCreateLabOrder={onCreateLabOrder}
          />
        </LabActiveSection>

        {actionError && (
          <div className={deskCalloutClass('error', 'text-sm')} id="nc-lab-action-error" role="alert">
            {actionError}
          </div>
        )}
      </div>

      <LabActiveStickyFooter>
        {canTake && (
          <Button
            type="button"
            id="nc-lab-take-btn"
            variant="cta"
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
      </LabActiveStickyFooter>
    </LabActiveShell>
  );
}
