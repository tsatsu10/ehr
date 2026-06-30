import { useEffect } from 'react';
import { usePageHeadingRefresh, usePageHeadingUpdated } from '@core/usePageHeadingToolbar';
import type { ClinicalDocLens } from './clinicalDocTypes';

interface Options {
  tab: ClinicalDocLens;
  contextLabel: string;
  advancedUrl: string | null;
  lastUpdated: Date | null;
  onTabChange: (tab: ClinicalDocLens) => void;
  onRefresh: () => void;
}

export function allowedLenses(props: {
  canVisit: boolean;
  canConsult: boolean;
  canScreening: boolean;
  canNursing: boolean;
  canOrders: boolean;
  canSpecialty: boolean;
}): ClinicalDocLens[] {
  const tabs: ClinicalDocLens[] = [];
  if (props.canVisit) tabs.push('visit');
  if (props.canConsult) tabs.push('consult');
  if (props.canScreening) tabs.push('screening');
  if (props.canNursing) tabs.push('nursing');
  if (props.canOrders) tabs.push('orders');
  if (props.canSpecialty) tabs.push('specialty');
  return tabs;
}

export function firstAllowedLens(
  initial: ClinicalDocLens,
  tabs: ClinicalDocLens[],
): ClinicalDocLens {
  if (tabs.includes(initial)) return initial;
  return tabs[0] ?? 'visit';
}

export function useClinicalDocPageHeading({
  tab,
  contextLabel,
  advancedUrl,
  lastUpdated,
  onTabChange,
  onRefresh,
}: Options): void {
  usePageHeadingUpdated('nc-clinicaldoc-updated', lastUpdated);
  usePageHeadingRefresh('nc-clinicaldoc-refresh', onRefresh);

  useEffect(() => {
    const el = document.getElementById('nc-clinicaldoc-context');
    if (el) {
      el.textContent = contextLabel;
    }
  }, [contextLabel]);

  useEffect(() => {
    const advanced = document.getElementById('nc-clinicaldoc-advanced');
    if (advanced && advancedUrl) {
      advanced.setAttribute('href', advancedUrl);
    }
  }, [advancedUrl]);

  useEffect(() => {
    const toolbar = document.getElementById('nc-clinicaldoc-toolbar');
    if (!toolbar) return undefined;

    const buttons = toolbar.querySelectorAll<HTMLButtonElement>('button[data-tab]');
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
  }, [tab]);

  useEffect(() => {
    const toolbar = document.getElementById('nc-clinicaldoc-toolbar');
    if (!toolbar) return undefined;

    const handler = (event: Event) => {
      const target = event.target as HTMLButtonElement | null;
      const tabName = target?.dataset?.tab as ClinicalDocLens | undefined;
      if (
        tabName === 'visit'
        || tabName === 'consult'
        || tabName === 'screening'
        || tabName === 'nursing'
        || tabName === 'orders'
        || tabName === 'specialty'
      ) {
        onTabChange(tabName);
      }
    };

    toolbar.addEventListener('click', handler);
    return () => toolbar.removeEventListener('click', handler);
  }, [onTabChange]);
}
