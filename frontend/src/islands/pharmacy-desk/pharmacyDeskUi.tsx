import { createDeskUi } from '@components/DeskUi';
import { Pill } from 'lucide-react';

const ui = createDeskUi({
  prefix: 'pharmacy',
  queueAriaLabel: 'Pharmacy queue',
  stickyFooterAriaLabel: 'Pharmacy actions',
  emptyIcon: Pill,
  emptyMessage: 'Choose a patient from the pharmacy queue to start work.',
  loadingMessage: 'Loading visit…',
});

export const PharmacyDeskLayout = ui.DeskLayout;
export const PharmacyActiveShell = ui.ActiveShell;
export const PharmacyActiveEmpty = ui.ActiveEmpty;
export const PharmacyActiveLoading = ui.ActiveLoading;
export const PharmacyActiveSection = ui.ActiveSection;
export const PharmacyActiveStickyFooter = ui.ActiveStickyFooter;
export const PharmacyQueuePanel = ui.QueuePanel;
