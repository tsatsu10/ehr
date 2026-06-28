import { useEffect } from 'react';
import { usePageHeadingRefresh, usePageHeadingUpdated } from '@core/usePageHeadingToolbar';
import type { BillOpsTab } from './billOpsTypes';

interface Options {
  tab: BillOpsTab;
  lastUpdated: Date | null;
  onTabChange: (tab: BillOpsTab) => void;
  onRefresh: () => void;
}

const TAB_IDS: Record<BillOpsTab, string> = {
  corrections: 'corrections',
  payments: 'payments',
  close: 'close',
  outstanding: 'outstanding',
  insurance: 'insurance',
};

export function useBillOpsPageHeading({ tab, lastUpdated, onTabChange, onRefresh }: Options): void {
  usePageHeadingUpdated('nc-billops-updated', lastUpdated);
  usePageHeadingRefresh('nc-billops-refresh', onRefresh);

  useEffect(() => {
    const toolbar = document.getElementById('nc-billops-toolbar');
    if (!toolbar) return undefined;

    const buttons = toolbar.querySelectorAll<HTMLButtonElement>('button[data-tab]');
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
  }, [tab]);

  useEffect(() => {
    const toolbar = document.getElementById('nc-billops-toolbar');
    if (!toolbar) return undefined;

    const handler = (event: Event) => {
      const target = event.target as HTMLButtonElement | null;
      const tabName = target?.dataset?.tab;
      if (
        tabName === 'corrections'
        || tabName === 'payments'
        || tabName === 'close'
        || tabName === 'outstanding'
        || tabName === 'insurance'
      ) {
        onTabChange(tabName);
      }
    };

    toolbar.addEventListener('click', handler);
    return () => toolbar.removeEventListener('click', handler);
  }, [onTabChange]);
}

export function firstAllowedTab(
  initial: string,
  allowed: BillOpsTab[],
): BillOpsTab {
  if (allowed.includes(initial as BillOpsTab)) {
    return initial as BillOpsTab;
  }
  return allowed[0] ?? 'corrections';
}

export function allowedTabs(props: {
  canCorrect: boolean;
  canPayment: boolean;
  canClose: boolean;
  canOutstanding: boolean;
  canInsurance: boolean;
}): BillOpsTab[] {
  const tabs: BillOpsTab[] = [];
  if (props.canCorrect) tabs.push('corrections');
  if (props.canPayment) tabs.push('payments');
  if (props.canClose) tabs.push('close');
  if (props.canOutstanding) tabs.push('outstanding');
  if (props.canInsurance) tabs.push('insurance');
  return tabs;
}

export { TAB_IDS };
