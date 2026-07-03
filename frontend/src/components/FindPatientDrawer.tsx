/**
 * Slide-over patient search drawer (triage Find patient, etc.).
 */

import { PatientSearchWidget } from '@islands/front-desk/PatientSearchWidget';
import { SlideOver } from '@components/SlideOver';

export interface FindPatientDrawerProps {
  open: boolean;
  onClose: () => void;
  ajaxUrl: string;
  csrfToken: string;
  onSelectPatient: (pid: number) => void;
  title?: string;
}

export function FindPatientDrawer({
  open,
  onClose,
  ajaxUrl,
  csrfToken,
  onSelectPatient,
  title = 'Find patient',
}: FindPatientDrawerProps) {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={title}
      id="nc-triage-find-drawer"
      width="sm"
      initialFocusSelector="#nc-search-input"
    >
      <PatientSearchWidget
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        selectedPid={null}
        autoSelectFirst={false}
        showRegisterButton={false}
        onSelectPatient={(pid) => {
          onSelectPatient(pid);
          onClose();
        }}
        onRegisterPatient={() => {
          /* triage drawer: registration not offered */
        }}
      />
    </SlideOver>
  );
}
