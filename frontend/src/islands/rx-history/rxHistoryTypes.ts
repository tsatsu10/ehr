export interface RxHistoryRow {
  id: number;
  drug: string;
  sig: string;
  quantity: string;
  refills: number;
  status: 'dispensed' | 'pending' | 'discontinued';
  start_date: string | null;
  end_date: string | null;
  date_added: string | null;
  provider_name: string | null;
  encounter: number;
  editable: boolean;
  visit_id: number | null;
}

export interface RxHistoryPayload {
  rows: RxHistoryRow[];
  total: number;
  page: number;
  page_size: number;
  patient_name: string;
}

export interface RxHistoryProps {
  ajaxUrl: string;
  csrfToken: string;
  moduleUrl: string;
  pid: number;
}

export type RxHistoryStatusFilter = 'all' | 'active' | 'discontinued';
