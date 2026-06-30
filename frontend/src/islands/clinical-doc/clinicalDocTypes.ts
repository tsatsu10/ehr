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
}

export interface ClinicalDocVisitSummary {
  visit: {
    id: number;
    queue_number: number;
    state: string;
    encounter: number;
    pid: number;
  };
  patient: {
    display_name: string;
    pubpid: string;
  };
  sign_status: {
    encounter_signed: boolean;
    require_esign_before_complete_consult: boolean;
  };
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
