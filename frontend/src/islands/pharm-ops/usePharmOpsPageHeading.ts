import { useEffect } from 'react';
import { usePageHeadingDateInput } from '@core/usePageHeadingDateInput';
import { usePageHeadingRefresh, usePageHeadingUpdated } from '@core/usePageHeadingToolbar';
import type { PharmOpsTab, WorklistCounts } from './pharmOpsTypes';

interface PageHeadingOptions {
  tab: PharmOpsTab;
  counts: WorklistCounts;
  date: string;
  urgentFirst: boolean;
  lastUpdated: Date | null;
  canDispense?: boolean;
  canReceive?: boolean;
  canDestroy?: boolean;
  canManageCatalog?: boolean;
  canViewReports?: boolean;
  onTabChange: (tab: PharmOpsTab) => void;
  onDateChange: (date: string) => void;
  onUrgentFirstChange: (checked: boolean) => void;
  onRefresh: () => void;
  onSellOtc?: () => void;
  onReceiveStock?: () => void;
  onToggleSetup?: () => void;
}

function bindClick(id: string, handler: () => void): (() => void) | undefined {
  const el = document.getElementById(id);
  if (!el) return undefined;
  el.addEventListener('click', handler);
  return () => el.removeEventListener('click', handler);
}

/** Wire Twig page-heading toolbar slots for Pharmacy Operations Hub. */
export function usePharmOpsPageHeading({
  tab,
  counts,
  date,
  urgentFirst,
  lastUpdated,
  canDispense = false,
  canReceive = false,
  canDestroy = false,
  canManageCatalog = false,
  canViewReports = true,
  onTabChange,
  onDateChange,
  onUrgentFirstChange,
  onRefresh,
  onSellOtc,
  onReceiveStock,
  onToggleSetup,
}: PageHeadingOptions): void {
  usePageHeadingDateInput('nc-pharmops-date', date, onDateChange);
  usePageHeadingUpdated('nc-pharmops-updated', lastUpdated);
  usePageHeadingRefresh('nc-pharmops-refresh', onRefresh);

  useEffect(() => {
    const pendingBtn = document.getElementById('nc-pharmops-tab-pending');
    if (pendingBtn) pendingBtn.classList.toggle('active', tab === 'pending_dispense');

    const lowStockBtn = document.getElementById('nc-pharmops-tab-lowstock');
    if (lowStockBtn) lowStockBtn.classList.toggle('active', tab === 'low_stock');

    const writeOffBtn = document.getElementById('nc-pharmops-tab-writeoff');
    if (writeOffBtn) {
      writeOffBtn.classList.toggle('active', tab === 'write_off');
      writeOffBtn.classList.toggle('nc-hidden', !canDestroy);
    }

    const reportsBtn = document.getElementById('nc-pharmops-tab-reports');
    if (reportsBtn) {
      reportsBtn.classList.toggle('active', tab === 'reports');
      reportsBtn.classList.toggle('nc-hidden', !canViewReports);
    }

    const dateEl = document.getElementById('nc-pharmops-date');
    if (dateEl) {
      dateEl.classList.toggle('nc-hidden', tab === 'reports' || tab === 'write_off');
    }

    const urgentWrap = document.getElementById('nc-pharmops-urgent-wrap');
    if (urgentWrap) {
      urgentWrap.classList.toggle('nc-hidden', tab === 'reports' || tab === 'write_off');
    }

    const pendingCount = document.getElementById('nc-pharmops-count-pending');
    if (pendingCount) {
      pendingCount.textContent = String(counts.pending_dispense ?? 0);
    }

    const lowStockCount = document.getElementById('nc-pharmops-count-lowstock');
    if (lowStockCount) {
      lowStockCount.textContent = String(counts.low_stock ?? 0);
    }

    const writeOffCount = document.getElementById('nc-pharmops-count-writeoff');
    if (writeOffCount) {
      writeOffCount.textContent = String(counts.write_off ?? 0);
    }
  }, [canDestroy, canViewReports, counts, tab]);

  useEffect(() => {
    const urgentEl = document.getElementById('nc-pharmops-urgent-first') as HTMLInputElement | null;
    if (urgentEl && urgentEl.checked !== urgentFirst) {
      urgentEl.checked = urgentFirst;
    }
  }, [urgentFirst]);

  useEffect(() => {
    const cleanup = bindClick('nc-pharmops-tab-pending', () => onTabChange('pending_dispense'));
    return () => cleanup?.();
  }, [onTabChange]);

  useEffect(() => {
    const cleanup = bindClick('nc-pharmops-tab-lowstock', () => onTabChange('low_stock'));
    return () => cleanup?.();
  }, [onTabChange]);

  useEffect(() => {
    const cleanup = bindClick('nc-pharmops-tab-writeoff', () => onTabChange('write_off'));
    return () => cleanup?.();
  }, [onTabChange]);

  useEffect(() => {
    if (!canViewReports) return undefined;
    const cleanup = bindClick('nc-pharmops-tab-reports', () => onTabChange('reports'));
    return () => cleanup?.();
  }, [canViewReports, onTabChange]);

  useEffect(() => {
    const sellOtcBtn = document.getElementById('nc-pharmops-sell-otc');
    if (sellOtcBtn) {
      sellOtcBtn.classList.toggle('nc-hidden', !canDispense);
      sellOtcBtn.toggleAttribute('disabled', !canDispense);
    }
  }, [canDispense]);

  useEffect(() => {
    if (!onSellOtc) return undefined;
    const cleanup = bindClick('nc-pharmops-sell-otc', onSellOtc);
    return () => cleanup?.();
  }, [onSellOtc]);

  useEffect(() => {
    const receiveBtn = document.getElementById('nc-pharmops-receive');
    if (receiveBtn) {
      receiveBtn.classList.toggle('nc-hidden', !canReceive);
      receiveBtn.toggleAttribute('disabled', !canReceive);
    }
  }, [canReceive]);

  useEffect(() => {
    if (!onReceiveStock) return undefined;
    const cleanup = bindClick('nc-pharmops-receive', onReceiveStock);
    return () => cleanup?.();
  }, [onReceiveStock]);

  useEffect(() => {
    const setupBtn = document.getElementById('nc-pharmops-setup');
    if (setupBtn) {
      setupBtn.classList.toggle('nc-hidden', !canManageCatalog);
      setupBtn.toggleAttribute('disabled', !canManageCatalog);
    }
  }, [canManageCatalog]);

  useEffect(() => {
    if (!onToggleSetup) return undefined;
    const cleanup = bindClick('nc-pharmops-setup', onToggleSetup);
    return () => cleanup?.();
  }, [onToggleSetup]);

  useEffect(() => {
    const urgentEl = document.getElementById('nc-pharmops-urgent-first') as HTMLInputElement | null;
    if (!urgentEl) return undefined;
    const handler = () => onUrgentFirstChange(urgentEl.checked);
    urgentEl.addEventListener('change', handler);
    return () => urgentEl.removeEventListener('change', handler);
  }, [onUrgentFirstChange]);
}
