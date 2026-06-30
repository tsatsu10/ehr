export type ReportHubLens =
  | 'today'
  | 'clinical'
  | 'pharmacy'
  | 'financial'
  | 'public_health'
  | 'audit';

export interface ReportHubCard {
  id: string;
  lens: ReportHubLens;
  title: string;
  blurb: string;
  url: string;
  kind: 'stock' | 'module' | 'placeholder';
  note?: string;
}

export interface ReportHubCatalog {
  lenses: ReportHubLens[];
  cards: ReportHubCard[];
  show_us_quality: boolean;
}

export interface ReportHubSummary {
  visit_date: string;
  visits_started: number;
  cash_total: number;
  receipt_count: number;
  currency_symbol: string;
}

export interface ReportHubProps {
  ajaxUrl: string;
  csrfToken: string;
  moduleUrl: string;
  reportsUrl: string;
  visitBoardUrl: string;
  billOpsUrl: string;
  pharmOpsUrl: string;
  facilityId: number;
  initialTab: string;
  canToday: boolean;
  canClinical: boolean;
  canPharmacy: boolean;
  canFinancial: boolean;
  canPublicHealth: boolean;
  canAudit: boolean;
  canShowAdvanced: boolean;
  webroot: string;
}

export const LENS_LABELS: Record<ReportHubLens, string> = {
  today: 'Today',
  clinical: 'Clinical',
  pharmacy: 'Pharmacy',
  financial: 'Financial',
  public_health: 'Public health',
  audit: 'Audit',
};
