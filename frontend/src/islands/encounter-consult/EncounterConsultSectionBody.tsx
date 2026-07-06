import { EncounterAttestationSection } from './EncounterAttestationSection';
import { EncounterBackgroundSection } from './EncounterBackgroundSection';
import { EncounterCcSection } from './EncounterCcSection';
import { EncounterDataReviewedSection } from './EncounterDataReviewedSection';
import { EncounterFollowUpSection } from './EncounterFollowUpSection';
import { EncounterHpiSection } from './EncounterHpiSection';
import { EncounterPeSection } from './EncounterPeSection';
import { EncounterProblemsSection } from './EncounterProblemsSection';
import { EncounterReferralSection } from './EncounterReferralSection';
import { EncounterRosSection } from './EncounterRosSection';
import { EncounterSourceSection } from './EncounterSourceSection';
import { EncounterVitalsSection } from './EncounterVitalsSection';
import type {
  EncounterConsultSectionId,
  EncounterNoteConfig,
  EncounterNotePrefill,
  EncounterNoteSections,
  EncounterSignMeta,
  EncounterSupervisorMeta,
} from './encounterConsultTypes';
import type { RosSystemName } from './encounterRosSystems';

export interface EncounterConsultSectionBodyProps {
  sectionId: EncounterConsultSectionId;
  sections: EncounterNoteSections;
  prefill: EncounterNotePrefill;
  noteConfig: EncounterNoteConfig;
  supervisor: EncounterSupervisorMeta;
  signMeta: EncounterSignMeta | null;
  encounterId: number;
  facilityId: number;
  ajaxUrl: string;
  csrfToken: string;
  rosSystems: RosSystemName[];
  readOnly: boolean;
  onSectionChange: <K extends keyof EncounterNoteSections>(
    key: K,
    value: EncounterNoteSections[K],
  ) => void;
  onSupervisorUpdated: (supervisor: EncounterSupervisorMeta) => void;
  onNotice: (message: string, tone: 'success' | 'danger') => void;
  onFocus: (id: EncounterConsultSectionId) => void;
}

export function EncounterConsultSectionBody({
  sectionId,
  sections,
  prefill,
  noteConfig,
  supervisor,
  signMeta,
  encounterId,
  facilityId,
  ajaxUrl,
  csrfToken,
  rosSystems,
  readOnly,
  onSectionChange,
  onSupervisorUpdated,
  onNotice,
  onFocus,
}: EncounterConsultSectionBodyProps) {
  const focus = () => onFocus(sectionId);

  switch (sectionId) {
    case 'referral':
      return (
        <EncounterReferralSection
          section={sections.referral}
          readOnly={readOnly}
          onChange={(referral) => onSectionChange('referral', referral)}
          onFocus={focus}
        />
      );
    case 'source':
      return (
        <EncounterSourceSection
          section={sections.source}
          readOnly={readOnly}
          onChange={(source) => onSectionChange('source', source)}
          onFocus={focus}
        />
      );
    case 'cc':
      return (
        <EncounterCcSection
          chiefComplaint={sections.cc.chief_complaint}
          readOnly={readOnly}
          onChange={(chiefComplaint) => onSectionChange('cc', { chief_complaint: chiefComplaint })}
          onFocus={focus}
        />
      );
    case 'hpi':
      return (
        <EncounterHpiSection
          section={sections.hpi}
          readOnly={readOnly}
          onChange={(hpi) => onSectionChange('hpi', hpi)}
          onFocus={focus}
        />
      );
    case 'ros':
      return (
        <EncounterRosSection
          section={sections.ros}
          systems={rosSystems}
          readOnly={readOnly}
          onChange={(ros) => onSectionChange('ros', ros)}
          onFocus={focus}
        />
      );
    case 'background':
      return <EncounterBackgroundSection prefill={prefill} />;
    case 'vitals':
      return <EncounterVitalsSection prefill={prefill} />;
    case 'pe':
      return (
        <EncounterPeSection
          section={sections.pe}
          overlays={noteConfig.specialty_pe_overlays ?? []}
          readOnly={readOnly}
          onChange={(pe) => onSectionChange('pe', pe)}
          onFocus={focus}
        />
      );
    case 'data_reviewed':
      return (
        <EncounterDataReviewedSection
          section={sections.data_reviewed}
          recentLabs={prefill.recent_labs ?? []}
          readOnly={readOnly}
          onChange={(dataReviewed) => onSectionChange('data_reviewed', dataReviewed)}
          onFocus={focus}
        />
      );
    case 'problems':
      return (
        <EncounterProblemsSection
          sections={sections}
          readOnly={readOnly}
          requireIcd={noteConfig.require_icd}
          onChange={(problems) => onSectionChange('problems', problems)}
          onFocus={focus}
        />
      );
    case 'follow_up':
      return (
        <EncounterFollowUpSection
          section={sections.follow_up}
          readOnly={readOnly}
          onChange={(followUp) => onSectionChange('follow_up', followUp)}
          onFocus={focus}
        />
      );
    case 'attestation':
      return (
        <EncounterAttestationSection
          sections={sections}
          supervisor={supervisor}
          signMeta={signMeta}
          encounterId={encounterId}
          facilityId={facilityId}
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          supervisorRequired={noteConfig.supervisor_required}
          readOnly={readOnly}
          onAttestationChange={(attested) => onSectionChange('attestation', {
            supervisor_attested: attested,
          })}
          onSupervisorUpdated={onSupervisorUpdated}
          onNotice={onNotice}
        />
      );
    default: {
      const never: never = sectionId;
      return never;
    }
  }
}
