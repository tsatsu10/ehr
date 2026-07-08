import { createDeskUi } from '@components/DeskUi';
import { FlaskConical } from 'lucide-react';

const ui = createDeskUi({
  prefix: 'lab',
  queueAriaLabel: 'Lab queue',
  stickyFooterAriaLabel: 'Lab actions',
  emptyIcon: FlaskConical,
  emptyMessage: 'Choose a patient from the lab queue to start work.',
  loadingMessage: 'Loading visit…',
});

export const LabDeskLayout = ui.DeskLayout;
export const LabActiveShell = ui.ActiveShell;
export const LabActiveEmpty = ui.ActiveEmpty;
export const LabActiveLoading = ui.ActiveLoading;
export const LabActiveSection = ui.ActiveSection;
export const LabActiveStickyFooter = ui.ActiveStickyFooter;
export const LabQueuePanel = ui.QueuePanel;
