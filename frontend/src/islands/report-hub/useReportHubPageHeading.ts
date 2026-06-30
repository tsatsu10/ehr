import { useEffect } from 'react';
import { usePageHeadingRefresh, usePageHeadingUpdated } from '@core/usePageHeadingToolbar';
import type { ReportHubLens } from './reportHubTypes';

interface Options {
  tab: ReportHubLens;
  summaryLabel: string;
  lastUpdated: Date | null;
  onTabChange: (tab: ReportHubLens) => void;
  onRefresh: () => void;
}

export function useReportHubPageHeading({
  tab,
  summaryLabel,
  lastUpdated,
  onTabChange,
  onRefresh,
}: Options): void {
  usePageHeadingUpdated('nc-reporthub-updated', lastUpdated);
  usePageHeadingRefresh('nc-reporthub-refresh', onRefresh);

  useEffect(() => {
    const kpi = document.getElementById('nc-reporthub-kpis');
    if (kpi) {
      kpi.textContent = summaryLabel;
    }
  }, [summaryLabel]);

  useEffect(() => {
    const toolbar = document.getElementById('nc-reporthub-toolbar');
    if (!toolbar) return undefined;

    const buttons = toolbar.querySelectorAll<HTMLButtonElement>('button[data-tab]');
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
  }, [tab]);

  useEffect(() => {
    const toolbar = document.getElementById('nc-reporthub-toolbar');
    if (!toolbar) return undefined;

    const handler = (event: Event) => {
      const target = event.target as HTMLButtonElement | null;
      const tabName = target?.dataset?.tab;
      if (
        tabName === 'today'
        || tabName === 'clinical'
        || tabName === 'pharmacy'
        || tabName === 'financial'
        || tabName === 'public_health'
        || tabName === 'audit'
      ) {
        onTabChange(tabName);
      }
    };

    toolbar.addEventListener('click', handler);
    return () => toolbar.removeEventListener('click', handler);
  }, [onTabChange]);
}

export function firstAllowedLens(
  initial: string,
  allowed: ReportHubLens[],
): ReportHubLens {
  if (allowed.includes(initial as ReportHubLens)) {
    return initial as ReportHubLens;
  }
  return allowed[0] ?? 'today';
}

export function allowedLenses(props: {
  canToday: boolean;
  canClinical: boolean;
  canPharmacy: boolean;
  canFinancial: boolean;
  canPublicHealth: boolean;
  canAudit: boolean;
}): ReportHubLens[] {
  const lenses: ReportHubLens[] = [];
  if (props.canToday) lenses.push('today');
  if (props.canClinical) lenses.push('clinical');
  if (props.canPharmacy) lenses.push('pharmacy');
  if (props.canFinancial) lenses.push('financial');
  if (props.canPublicHealth) lenses.push('public_health');
  if (props.canAudit) lenses.push('audit');
  return lenses;
}
