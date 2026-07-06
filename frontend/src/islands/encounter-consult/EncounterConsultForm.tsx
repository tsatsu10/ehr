import { Button } from '@components/ui/button';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { EncounterConsultSectionBody } from './EncounterConsultSectionBody';
import { EncounterFormHeader } from './EncounterFormHeader';
import { EncounterSectionNav, EncounterSectionPager } from './EncounterSectionNav';
import { EncounterSignDialog } from './EncounterSignDialog';
import { EncounterUnlockDialog } from './EncounterUnlockDialog';
import { EncounterValidationList } from './EncounterValidationList';
import type { EncounterConsultProps } from './encounterConsultTypes';
import { ENCOUNTER_SECTIONS } from './encounterConsultTypes';
import {
  EncounterContextStrip,
  EncounterLayout,
  EncounterSectionCard,
  EncounterShell,
  EncounterSignedBanner,
  EncounterStatusBar,
  EncounterStickyFooter,
} from './encounterUi';
import { variantLabel } from './encounterVariants';
import { useEncounterConsultForm } from './useEncounterConsultForm';

export function EncounterConsultForm({
  ajaxUrl,
  csrfToken,
  visitId,
  facilityId,
  returnUrl,
  initialFocus,
}: EncounterConsultProps) {
  const form = useEncounterConsultForm({ ajaxUrl, csrfToken, visitId, initialFocus });

  if (form.loading) {
    return (
      <EncounterShell>
        <EncounterStatusBar message="Loading consultation note…" saving />
      </EncounterShell>
    );
  }

  if (form.loadError || !form.prefill) {
    return (
      <EncounterShell>
        <EncounterStatusBar message={form.loadError ?? 'Unable to load consult note'} tone="danger" />
        <Button type="button" variant="outline" onClick={() => void form.loadNote()}>
          Retry
        </Button>
      </EncounterShell>
    );
  }

  const { prefill } = form;
  const activeMeta = form.navSections[form.activeSectionIndex];
  const chipNav = form.mobileStepper;
  const focusMode = !form.mobileStepper;
  const visibleSectionMetas = ENCOUNTER_SECTIONS.filter((meta) => form.visibleIds.includes(meta.id));
  const sectionMetasToRender = focusMode
    ? visibleSectionMetas.filter((meta) => meta.id === form.activeSection)
    : visibleSectionMetas;

  return (
    <EncounterShell id="nc-encounter-consult-root">
      {prefill.patient.display_name && (
        <PatientContextBanner
          layout="compact"
          identity={{
            pid: form.patientPid > 0 ? form.patientPid : undefined,
            display_name: prefill.patient.display_name,
            pubpid: prefill.patient.pubpid,
            sex: prefill.patient.sex,
            age_years: prefill.patient.age_years ?? undefined,
          }}
          chiefComplaint={prefill.chief_complaint || null}
          className="mb-1"
        />
      )}

      <EncounterFormHeader
        variantLabel={variantLabel(form.variant)}
        statusMessage={form.statusMessage}
        statusTone={form.statusTone}
        saving={form.saving || form.validating || form.signing}
        completedCount={form.completedSectionCount}
        totalSections={form.navSections.length}
        activeIndex={form.activeSectionIndex}
        phases={form.visiblePhases}
        showPhaseLegend={chipNav}
      />

      <EncounterContextStrip
        prefill={prefill}
        acknowledged={form.sections.context}
        onAcknowledge={form.updateContext}
        readOnly={form.readOnly}
      />

      <EncounterValidationList errors={form.validationErrors} />

      {form.signed && form.signMeta && (
        <EncounterSignedBanner
          signMeta={form.signMeta}
          supervisorName={form.supervisor.supervisor_display_name}
        />
      )}

      <EncounterLayout
        mobileStepper={form.mobileStepper}
        nav={(
          <EncounterSectionNav
            sections={form.navSections}
            activeId={form.activeSection}
            warningIds={form.warningSectionIds}
            chipMode={chipNav}
            onSelect={form.scrollToSection}
          />
        )}
        content={(
          <div className="nc-encounter-sections space-y-4">
            {(form.mobileStepper || form.viewport === 'tablet' || focusMode) && (
              <EncounterSectionPager
                activeIndex={form.activeSectionIndex}
                total={form.navSections.length}
                activeLabel={activeMeta?.label ?? 'Section'}
                onPrevious={form.goToPreviousSection}
                onNext={form.goToNextSection}
              />
            )}

            {sectionMetasToRender.map((meta) => {
              const navMeta = form.navSections.find((section) => section.id === meta.id);

              return (
                <EncounterSectionCard
                  key={meta.id}
                  id={meta.id}
                  title={meta.label}
                  step={navMeta?.step}
                  stepperMode={form.mobileStepper}
                  expanded={!form.mobileStepper || form.activeSection === meta.id}
                  onHeaderClick={form.mobileStepper ? () => form.scrollToSection(meta.id) : undefined}
                >
                  <EncounterConsultSectionBody
                    sectionId={meta.id}
                    sections={form.sections}
                    prefill={prefill}
                    noteConfig={form.noteConfig}
                    supervisor={form.supervisor}
                    signMeta={form.signMeta}
                    encounterId={form.encounterId}
                    facilityId={facilityId}
                    ajaxUrl={ajaxUrl}
                    csrfToken={csrfToken}
                    rosSystems={form.rosSystems}
                    readOnly={form.readOnly}
                    onSectionChange={form.updateSection}
                    onSupervisorUpdated={form.setSupervisor}
                    onNotice={(message, tone) => form.setStatusNotice(message, tone)}
                    onFocus={form.scrollToSection}
                  />
                </EncounterSectionCard>
              );
            })}
          </div>
        )}
        footer={(
          <EncounterStickyFooter mobileFixed={form.mobileStepper} className={form.mobileStepper ? 'nc-encounter-footer--fixed' : undefined}>
            <div className="text-sm text-[var(--oe-nc-text-muted)]">
              {form.signed
                ? 'Signed — read only'
                : form.lastSavedAt
                  ? `Last saved ${form.lastSavedAt}`
                  : 'Draft not saved yet'}
            </div>
            <div className="flex flex-wrap gap-2">
              {!form.mobileStepper && (
                <Button type="button" variant="outline" asChild>
                  <a href={returnUrl}>Back</a>
                </Button>
              )}
              {form.signed && form.canUnlockForCorrection && (
                <Button type="button" variant="outline" onClick={() => form.setUnlockOpen(true)}>
                  Unlock
                </Button>
              )}
              {!form.readOnly && (
                <>
                  <Button type="button" variant="outline" onClick={() => void form.persist(true)} disabled={form.saving}>
                    Save draft
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void form.runValidate()} disabled={form.validating || form.saving}>
                    Validate
                  </Button>
                  <Button
                    type="button"
                    onClick={form.openSignDialog}
                    disabled={form.validating || form.saving}
                  >
                    Sign note
                  </Button>
                </>
              )}
            </div>
          </EncounterStickyFooter>
        )}
      />

      <EncounterSignDialog
        open={form.signOpen}
        signing={form.signing}
        password={form.signPassword}
        amendment={form.signAmendment}
        error={form.signError}
        onOpenChange={form.setSignOpen}
        onPasswordChange={form.setSignPassword}
        onAmendmentChange={form.setSignAmendment}
        onConfirm={() => void form.handleSign()}
      />

      <EncounterUnlockDialog
        open={form.unlockOpen}
        unlocking={form.unlocking}
        reason={form.unlockReason}
        password={form.unlockPassword}
        error={form.unlockError}
        onOpenChange={form.setUnlockOpen}
        onReasonChange={form.setUnlockReason}
        onPasswordChange={form.setUnlockPassword}
        onConfirm={() => void form.handleUnlock()}
      />
    </EncounterShell>
  );
}
