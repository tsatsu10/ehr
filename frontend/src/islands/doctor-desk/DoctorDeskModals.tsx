import type {
  DoctorConsultPayload,
  DoctorQueueCard,
  DoctorReopenableRow,
  FormularyRxPlaceResult,
  LabPanelPlaceResult,
  RoutingPreview,
} from '@core/types';
import { RxAllergyOverrideModal } from '@components/RxAllergyOverrideModal';
import { DocFavoritesDrawer } from './DocFavoritesDrawer';
import { FormularyRxModal } from './FormularyRxModal';
import { HardAssignOverrideModal } from './HardAssignOverrideModal';
import { LabPanelModal } from './LabPanelModal';
import { ReopenModal } from './ReopenModal';
import { RoutingModal } from './RoutingModal';
import { RoutingOverrideModal } from './RoutingOverrideModal';
import type { useDoctorShortcutNav } from './useDoctorShortcutNav';

export interface DoctorDeskModalsProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  blocked: boolean;
  activeVisit: DoctorConsultPayload['visit'] | null;
  activePreview: DoctorConsultPayload['preview'] | null;
  routingPreview: RoutingPreview | null;
  routingOpen: boolean;
  labPanelOpen: boolean;
  formularyRxOpen: boolean;
  docFavoritesOpen: boolean;
  reopenTarget: DoctorReopenableRow | null;
  overrideCard: DoctorQueueCard | null;
  overrideSubmitting: boolean;
  hardAssignOverrideCard: DoctorQueueCard | null;
  shortcutNav: ReturnType<typeof useDoctorShortcutNav>;
  onRoutingClose: () => void;
  onRoutingCompleted: () => void;
  onReopenClose: () => void;
  onReopened: (payload: DoctorConsultPayload) => void;
  onReopenConflict: (message: string) => void;
  onOverrideClose: () => void;
  onOverrideConfirm: (reason: string) => void;
  onHardAssignClose: () => void;
  onHardAssignConfirm: (reason: string) => void;
  onLabPanelClose: () => void;
  onLabPlaced: (result: LabPanelPlaceResult) => void;
  onLabFullForm: () => void;
  onFormularyRxClose: () => void;
  onFormularyRxPlaced: (result: FormularyRxPlaceResult) => void;
  onFormularyRxFullForm: () => void;
  onDocFavoritesClose: () => void;
  onDocFavoritesError: (message: string) => void;
}

export function DoctorDeskModals({
  ajaxUrl,
  csrfToken,
  facilityId,
  blocked,
  activeVisit,
  activePreview,
  routingPreview,
  routingOpen,
  labPanelOpen,
  formularyRxOpen,
  docFavoritesOpen,
  reopenTarget,
  overrideCard,
  overrideSubmitting,
  hardAssignOverrideCard,
  shortcutNav,
  onRoutingClose,
  onRoutingCompleted,
  onReopenClose,
  onReopened,
  onReopenConflict,
  onOverrideClose,
  onOverrideConfirm,
  onHardAssignClose,
  onHardAssignConfirm,
  onLabPanelClose,
  onLabPlaced,
  onLabFullForm,
  onFormularyRxClose,
  onFormularyRxPlaced,
  onFormularyRxFullForm,
  onDocFavoritesClose,
  onDocFavoritesError,
}: DoctorDeskModalsProps) {
  return (
    <>
      <RoutingModal
        open={routingOpen}
        visit={activeVisit}
        preview={activePreview}
        routingPreview={routingPreview ?? null}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        blocked={blocked}
        onClose={onRoutingClose}
        onCompleted={onRoutingCompleted}
      />

      <ReopenModal
        open={reopenTarget !== null}
        target={reopenTarget}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        blocked={blocked}
        onClose={onReopenClose}
        onReopened={onReopened}
        onConflict={onReopenConflict}
      />

      <RoutingOverrideModal
        card={overrideCard}
        submitting={overrideSubmitting}
        onClose={onOverrideClose}
        onConfirm={onOverrideConfirm}
      />

      <HardAssignOverrideModal
        card={hardAssignOverrideCard}
        submitting={overrideSubmitting}
        onClose={onHardAssignClose}
        onConfirm={onHardAssignConfirm}
      />

      <LabPanelModal
        open={labPanelOpen}
        visit={activeVisit}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        blocked={blocked}
        onClose={onLabPanelClose}
        onPlaced={onLabPlaced}
        onFullLabForm={onLabFullForm}
      />

      <FormularyRxModal
        open={formularyRxOpen}
        visit={activeVisit}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        blocked={blocked}
        onClose={onFormularyRxClose}
        onPlaced={onFormularyRxPlaced}
        onFullRxForm={onFormularyRxFullForm}
      />

      <DocFavoritesDrawer
        open={docFavoritesOpen}
        visit={activeVisit}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        blocked={blocked}
        onClose={onDocFavoritesClose}
        onError={onDocFavoritesError}
      />

      <RxAllergyOverrideModal
        open={shortcutNav.rxOverrideOpen}
        preview={shortcutNav.rxOverridePreview}
        visit={shortcutNav.rxOverrideVisit}
        submitting={shortcutNav.rxOverrideSubmitting}
        error={shortcutNav.rxOverrideError}
        onClose={shortcutNav.closeRxOverride}
        onConfirm={(reason) => { void shortcutNav.confirmRxOverride(reason); }}
      />
    </>
  );
}
