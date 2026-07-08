import { createDeskUi } from '@components/DeskUi';
import { Banknote } from 'lucide-react';

const ui = createDeskUi({
  prefix: 'cashier',
  queueAriaLabel: 'Payment queue',
  stickyFooterAriaLabel: 'Checkout actions',
  emptyIcon: Banknote,
  emptyTitle: 'No visit selected',
  emptyMessage:
    'Choose a patient from the payment queue or find a patient to start checkout.',
  loadingMessage: 'Loading visit…',
  queueCountAriaLabel: (count) => `${count} waiting`,
});

export const CashierDeskLayout = ui.DeskLayout;
export const CashierActiveShell = ui.ActiveShell;
export const CashierActiveEmpty = ui.ActiveEmpty;
export const CashierActiveLoading = ui.ActiveLoading;
export const CashierActiveSection = ui.ActiveSection;
export const CashierActiveStickyFooter = ui.ActiveStickyFooter;
export const CashierQueuePanel = ui.QueuePanel;
