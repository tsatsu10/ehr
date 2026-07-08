import { createDeskUi } from '@components/DeskUi';
import { Stethoscope } from 'lucide-react';

const ui = createDeskUi({
  prefix: 'triage',
  queueAriaLabel: 'Triage queue',
  stickyFooterAriaLabel: 'Triage actions',
  emptyIcon: Stethoscope,
  emptyMessage: 'Select a patient from the triage queue or use Find patient.',
  loadingMessage: 'Loading patient…',
});

export const TriageDeskLayout = ui.DeskLayout;
export const TriageActiveShell = ui.ActiveShell;
export const TriageActiveEmpty = ui.ActiveEmpty;
export const TriageActiveLoading = ui.ActiveLoading;
export const TriageActiveSection = ui.ActiveSection;
export const TriageActiveStickyFooter = ui.ActiveStickyFooter;
export const TriageQueuePanel = ui.QueuePanel;
