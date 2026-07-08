import { createDeskUi } from '@components/DeskUi';
import { Stethoscope } from 'lucide-react';

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
