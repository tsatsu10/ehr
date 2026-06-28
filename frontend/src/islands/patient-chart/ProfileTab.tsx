import { RegistrationForm } from '@islands/front-desk/RegistrationForm';
import type { ChecklistLevel, PaymentsStripData, RegistrationGetData } from './patientChartTypes';
import { PaymentsStrip } from './PaymentsStrip';
import { ProfileChecklist } from './ProfileChecklist';

interface ProfileTabProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  registrationMode: string;
  checklist: RegistrationGetData | null;
  payments: PaymentsStripData | null;
  onProfileSaved: () => void;
}

export function ProfileTab({
  ajaxUrl,
  csrfToken,
  pid,
  registrationMode,
  checklist,
  payments,
  onProfileSaved,
}: ProfileTabProps) {
  const levels = (checklist?.completion_by_level ?? []) as ChecklistLevel[];
  const completion = checklist?.completion ?? { score: 0, billing_threshold: 70, missing_labels: [] };

  return (
    <>
      <PaymentsStrip data={payments} />
      <ProfileChecklist levels={levels} completion={completion} />
      <RegistrationForm
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        pid={pid}
        registrationMode={registrationMode}
        chartMode
        onSaved={() => {
          onProfileSaved();
        }}
        onUseExisting={() => {
          /* chart mode always has pid */
        }}
        onCancel={() => {
          window.history.back();
        }}
      />
    </>
  );
}
