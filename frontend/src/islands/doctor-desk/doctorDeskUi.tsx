import { createDeskUi } from '@components/DeskUi';
import { Stethoscope } from 'lucide-react';

// NOTE: createDeskUi() runs at module scope and its returned components close
// over these strings at call time -- calling t() here would freeze whatever
// locale was active at import time (the "no module-scope t()" rule in
// @core/i18n). DeskUi is also shared by the other (not-yet-migrated) desks,
// so this factory's config stays plain English until DeskUi itself is
// reworked to resolve labels at render time.
const ui = createDeskUi({
  prefix: 'doctor',
  queueAriaLabel: 'Doctor queue',
  stickyFooterAriaLabel: 'Consult actions',
  emptyIcon: Stethoscope,
  emptyMessage: 'Choose a patient from the queue to start the consult.',
  loadingMessage: 'Loading consult…',
  queueCountAriaLabel: (count) => `${count} waiting`,
});

export const DoctorDeskLayout = ui.DeskLayout;
export const DoctorActiveShell = ui.ActiveShell;
export const DoctorActiveEmpty = ui.ActiveEmpty;
export const DoctorActiveLoading = ui.ActiveLoading;
export const DoctorActiveSection = ui.ActiveSection;
export const DoctorActiveStickyFooter = ui.ActiveStickyFooter;
export const DoctorQueuePanel = ui.QueuePanel;
