export type ReportHubLens =
  | 'today'
  | 'clinical'
  | 'pharmacy'
  | 'financial'
  | 'public_health'
  | 'audit'
  | 'unfiled_documents';

export interface ReportHubCard {
  id: string;
  lens: ReportHubLens;
  title: string;
  blurb: string;
  url: string;
  kind: 'stock' | 'module' | 'placeholder' | 'native';
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

export interface ReportHubBillOpsEmbedProps {
  canCorrect: boolean;
  canPayment: boolean;
  canClose: boolean;
  canOutstanding: boolean;
  canInsurance: boolean;
  canPayerBilling: boolean;
  reopenOnCorrection: boolean;
}

export interface ReportHubEmbedContext {
  ajaxUrl: string;
  csrfToken: string;
  webroot: string;
  facilityId: number;
  visitBoardUrl: string;
  frontDeskUrl: string;
  moduleUrl: string;
  cashierUrl: string;
  reportsUrl: string;
  chartUrlBase: string;
  billingThreshold: number;
  visitDate: string;
  canCancelVisit: boolean;
  canMarkUnpaid: boolean;
  canRunReconciliation: boolean;
  scheduledIntegrationEnabled: boolean;
  canStartVisit: boolean;
  billOps: ReportHubBillOpsEmbedProps;
  currencyFormat?: {
    currency_code?: string;
    currency_symbol?: string;
    currency_decimals?: number;
    currency_symbol_position?: 'before' | 'after';
  };
}

export interface ReportHubProps {
  ajaxUrl: string;
  csrfToken: string;
  moduleUrl: string;
  reportsUrl: string;
  visitBoardUrl: string;
  frontDeskUrl: string;
  billOpsUrl: string;
  pharmOpsUrl: string;
  cashierUrl: string;
  chartUrlBase: string;
  billingThreshold: number;
  facilityId: number;
  initialTab: string;
  canToday: boolean;
  canClinical: boolean;
  canPharmacy: boolean;
  canFinancial: boolean;
  canPublicHealth: boolean;
  canAudit: boolean;
  canUnfiledDocuments: boolean;
  canShowAdvanced: boolean;
  webroot: string;
  canCancelVisit: boolean;
  canMarkUnpaid: boolean;
  canRunReconciliation: boolean;
  scheduledIntegrationEnabled: boolean;
  canStartVisit: boolean;
  canBillOpsCorrect: boolean;
  canBillOpsPayment: boolean;
  canBillOpsClose: boolean;
  canBillOpsOutstanding: boolean;
  canBillOpsInsurance: boolean;
  canBillOpsPayerBilling: boolean;
  reopenOnCorrection: boolean;
  runbooks?: ReportHubRunbookCard[];
  currencyFormat?: ReportHubEmbedContext['currencyFormat'];
}

export interface ReportHubRunbookCard {
  id: string;
  cadence: string;
  title: string;
  screen: string;
  detail: string;
  url: string | null;
  search_text: string;
}

export const LENS_LABELS: Record<ReportHubLens, string> = {
  today: 'Today',
  clinical: 'Clinical',
  pharmacy: 'Pharmacy',
  financial: 'Financial',
  public_health: 'Public health',
  audit: 'Audit',
  unfiled_documents: 'Unfiled documents',
};
