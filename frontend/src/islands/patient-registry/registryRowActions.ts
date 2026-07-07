import type { RowActionItem } from '@components/RowActionsMenu';
import { recallsUrlForPatient } from '@islands/scheduling/schedulingShellUtils';
import type { RegistryRow } from './registryTypes';

export interface RegistryRowActionContext {
  chartUrlBase: string;
  visitBoardUrl: string;
  frontDeskUrl: string;
  moduleUrl: string;
  facilityId: number;
  visitDate: string;
  scheduledIntegrationEnabled: boolean;
  canStartVisit: boolean;
}

function appendQuery(baseUrl: string, params: Record<string, string | number>): string {
  const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return `${url.pathname}${url.search}`;
}

export function visitBoardUrlForPatient(visitBoardUrl: string, pid: number): string {
  return appendQuery(visitBoardUrl, { pid });
}

export function frontDeskUrlForPatient(frontDeskUrl: string, pid: number): string {
  return appendQuery(frontDeskUrl, { pid });
}

export function buildRegistryRowActions(
  row: RegistryRow,
  context: RegistryRowActionContext,
): RowActionItem[] {
  const chartUrl = row.chart_url
    ?? `${context.chartUrlBase}?pid=${encodeURIComponent(String(row.pid))}`;

  const items: RowActionItem[] = [
    { id: 'chart', label: 'Open chart', href: chartUrl },
  ];

  items.push({
    id: 'visit-board',
    label: 'Filter Visit Board',
    href: visitBoardUrlForPatient(context.visitBoardUrl, row.pid),
  });

  if (context.scheduledIntegrationEnabled) {
    items.push({
      id: 'recalls',
      label: 'Open recall worklist',
      href: recallsUrlForPatient(context.moduleUrl, {
        date: context.visitDate,
        facilityId: context.facilityId,
        providerId: 0,
      }, row.pid),
    });
  }

  if (context.canStartVisit && !row.has_active_visit_today) {
    items.push({
      id: 'start-visit',
      label: 'Start visit',
      href: frontDeskUrlForPatient(context.frontDeskUrl, row.pid),
    });
  }

  return items;
}
