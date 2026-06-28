import { useEffect } from 'react';
import { usePageHeadingDateInput } from '@core/usePageHeadingDateInput';
import { usePageHeadingRefresh, usePageHeadingUpdated } from '@core/usePageHeadingToolbar';
import type { FulfillmentFilter, LabOpsTab, WorklistCounts } from './labOpsTypes';

interface PageHeadingOptions {
  tab: LabOpsTab;
  counts: WorklistCounts;
  date: string;
  fulfillment: FulfillmentFilter;
  urgentFirst: boolean;
  lastUpdated: Date | null;
  onTabChange: (tab: LabOpsTab) => void;
  onDateChange: (date: string) => void;
  onFulfillmentChange: (value: FulfillmentFilter) => void;
  onUrgentFirstChange: (checked: boolean) => void;
  onRefresh: () => void;
}

const TAB_BUTTONS: { tab: LabOpsTab; buttonId: string; countId: string }[] = [
  { tab: 'pending', buttonId: 'nc-labops-tab-pending', countId: 'nc-labops-count-pending' },
  { tab: 'in_progress', buttonId: 'nc-labops-tab-progress', countId: 'nc-labops-count-progress' },
  { tab: 'send_out', buttonId: 'nc-labops-tab-sendout', countId: 'nc-labops-count-sendout' },
];

function bindClick(id: string, handler: () => void): (() => void) | undefined {
  const el = document.getElementById(id);
  if (!el) return undefined;
  el.addEventListener('click', handler);
  return () => el.removeEventListener('click', handler);
}

/** Wire Twig page-heading toolbar slots for Lab Operations Hub. */
export function useLabOpsPageHeading({
  tab,
  counts,
  date,
  fulfillment,
  urgentFirst,
  lastUpdated,
  onTabChange,
  onDateChange,
  onFulfillmentChange,
  onUrgentFirstChange,
  onRefresh,
}: PageHeadingOptions): void {
  usePageHeadingDateInput('nc-labops-date', date, onDateChange);
  usePageHeadingUpdated('nc-labops-updated', lastUpdated);
  usePageHeadingRefresh('nc-labops-refresh', onRefresh);

  useEffect(() => {
    for (const { tab: t, buttonId, countId } of TAB_BUTTONS) {
      const btn = document.getElementById(buttonId);
      if (btn) btn.classList.toggle('active', tab === t);

      const countEl = document.getElementById(countId);
      if (countEl) {
        const key = t === 'in_progress' ? 'in_progress' : t;
        countEl.textContent = String(counts[key as keyof WorklistCounts] ?? 0);
      }
    }
  }, [counts, tab]);

  useEffect(() => {
    const fulfillmentEl = document.getElementById('nc-labops-fulfillment') as HTMLSelectElement | null;
    if (fulfillmentEl && fulfillmentEl.value !== fulfillment) {
      fulfillmentEl.value = fulfillment;
    }
  }, [fulfillment]);

  useEffect(() => {
    const urgentEl = document.getElementById('nc-labops-urgent-first') as HTMLInputElement | null;
    if (urgentEl && urgentEl.checked !== urgentFirst) {
      urgentEl.checked = urgentFirst;
    }
  }, [urgentFirst]);

  useEffect(() => {
    const cleanups = TAB_BUTTONS.map(({ tab: t, buttonId }) =>
      bindClick(buttonId, () => onTabChange(t))
    );
    return () => cleanups.forEach((fn) => fn?.());
  }, [onTabChange]);

  useEffect(() => {
    const fulfillmentEl = document.getElementById('nc-labops-fulfillment') as HTMLSelectElement | null;
    if (!fulfillmentEl) return undefined;
    const handler = () => {
      const value = fulfillmentEl.value;
      if (value === 'all' || value === 'in_house' || value === 'send_out') {
        onFulfillmentChange(value);
      }
    };
    fulfillmentEl.addEventListener('change', handler);
    return () => fulfillmentEl.removeEventListener('change', handler);
  }, [onFulfillmentChange]);

  useEffect(() => {
    const urgentEl = document.getElementById('nc-labops-urgent-first') as HTMLInputElement | null;
    if (!urgentEl) return undefined;
    const handler = () => onUrgentFirstChange(urgentEl.checked);
    urgentEl.addEventListener('change', handler);
    return () => urgentEl.removeEventListener('change', handler);
  }, [onUrgentFirstChange]);
}
