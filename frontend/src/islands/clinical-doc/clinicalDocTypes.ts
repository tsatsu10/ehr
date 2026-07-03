export type ClinicalDocLens =
  | 'visit'
  | 'consult'
  | 'screening'
  | 'nursing'
  | 'orders'
  | 'specialty';

export interface ClinicalDocCard {
  id: string;
  lens: ClinicalDocLens;
  source_lens?: ClinicalDocLens;
  formdir: string;
  kind: 'form' | 'rx';
  title: string;
  description: string;
  primary?: boolean;
  more?: boolean;
  started?: boolean;
  form_id?: number | null;
  forms_row_id?: number | null;
  last_saved_at?: string | null;
  last_saved_by?: string | null;
  signed?: boolean;
  pin?: number;
  bundle_health?: {
    installed: boolean;
    esign_ok: boolean;
    status_label: string;
  };
}

export interface ClinicalDocSignOverview {
  encounter_signed: boolean;
  started_count: number;
  signed_count: number;
  unsigned_count: number;
  required_forms: Array<{
    formdir: string;
    title: string;
    started?: boolean;
  }>;
}

export interface ClinicalDocVisitSummary {
  visit: {
    id: number;
    queue_number: number;
    state: string;
    encounter: number;
    pid: number;
    service_profile?: string;
  };
  patient: {
    display_name: string;
    pubpid: string;
  };
  sign_status: {
    encounter_signed: boolean;
    require_esign_before_complete_consult: boolean;
  };
  sign_overview?: ClinicalDocSignOverview;
  addable_forms?: ClinicalDocCard[];
  lab_panel_order_enabled?: boolean;
  lenses: ClinicalDocLens[];
  cards: ClinicalDocCard[];
  show_us_quality?: boolean;
  advanced_encounter_url?: string;
}

export interface ClinicalDocProps {
  ajaxUrl: string;
  csrfToken: string;
  moduleUrl: string;
  doctorDeskUrl: string;
  visitBoardUrl: string;
  facilityId?: number;
  initialTab: ClinicalDocLens;
  initialVisitId?: number | null;
  canVisit: boolean;
  canConsult: boolean;
  canScreening: boolean;
  canNursing: boolean;
  canOrders: boolean;
  canSpecialty: boolean;
  canShowAdvanced: boolean;
  webroot: string;
}
