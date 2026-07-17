import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@components/ui/button';
import { RegistrationForm } from '@islands/front-desk/RegistrationForm';
import type { ChecklistLevel, PaymentsStripData, RegistrationGetData } from './patientChartTypes';
import { ChartStack } from './chartUi';
import { PaymentsStrip } from './PaymentsStrip';
import { ProfileChecklist } from './ProfileChecklist';
import { ProfileInfoPanel } from './ProfileInfoPanel';

interface ProfileTabProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  registrationMode: string;
  checklist: RegistrationGetData | null;
  payments: PaymentsStripData | null;
  /** Front desk, nurse, admin only — everyone else gets the read-only view. */
  canEditProfile?: boolean;
  onProfileSaved: () => void;
}

export function ProfileTab({
  ajaxUrl,
  csrfToken,
  pid,
  registrationMode,
  checklist,
  payments,
  canEditProfile = false,
  onProfileSaved,
}: ProfileTabProps) {
  // Profile is read-only until an authorised user clicks Edit. patients.update
  // enforces the same permission server-side (PROFILE_EDIT_ACL_ANY), so this is
  // purely the UI gate.
  const [editing, setEditing] = useState(false);
  const levels = (checklist?.completion_by_level ?? []) as ChecklistLevel[];
  const completion = checklist?.completion ?? { score: 0, billing_threshold: 70, missing_labels: [] };

  if (editing && canEditProfile) {
    return (
      <ChartStack>
        <div className="overflow-hidden rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-4 shadow-[var(--oe-nc-shadow-sm)]">
          <RegistrationForm
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            pid={pid}
            registrationMode={registrationMode}
            chartMode
            onSaved={() => {
              setEditing(false);
              onProfileSaved();
            }}
            onUseExisting={() => {
              /* chart mode always has pid */
            }}
            onCancel={() => {
              setEditing(false);
            }}
          />
        </div>
      </ChartStack>
    );
  }

  return (
    <ChartStack>
      {canEditProfile && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 h-4 w-4" aria-hidden />
            Edit profile
          </Button>
        </div>
      )}
      <ProfileInfoPanel data={checklist} />
      <PaymentsStrip data={payments} />
      <ProfileChecklist levels={levels} completion={completion} />
    </ChartStack>
  );
}
