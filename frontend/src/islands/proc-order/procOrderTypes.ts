export interface ProcOrderTest {
  procedure_type_id: number;
  name: string;
  code: string;
  /** Catalog default specimen (option id); '' when the catalog has none. */
  specimen: string;
  fee_amount: number | null;
  has_fee: boolean;
}

export interface ProcOrderLab {
  ppid: number;
  name: string;
  is_inhouse: boolean;
  tests: ProcOrderTest[];
}

export interface ProcOrderOption {
  id: string;
  title: string;
}

export interface ProcOrderExistingCode {
  procedure_code: string;
  procedure_name: string;
  /** Per-test specimen (option id) chosen when the order was placed. */
  specimen_type: string;
}

export interface ProcOrderExisting {
  procedure_order_id: number;
  lab_id: number;
  order_priority: string;
  specimen_type: string;
  specimen_volume: string;
  clinical_hx: string;
  order_diagnosis: string;
  codes: ProcOrderExistingCode[];
}

export interface ProcOrderFormData {
  enabled: boolean;
  visit_id: number;
  pid: number;
  encounter: number;
  facility_id: number;
  patient_name: string;
  /** Chief complaint from the consult; pre-fills Clinical history on a new order. */
  encounter_reason: string;
  labs: ProcOrderLab[];
  priority_options: ProcOrderOption[];
  specimen_options: ProcOrderOption[];
  default_lab_id: number;
  auto_bill_on_order: boolean;
  currency_symbol: string;
  order: ProcOrderExisting | null;
}

export interface ProcOrderBilling {
  posted_count?: number;
  charges_total?: number;
  unmapped_codes?: string[];
}

export interface ProcOrderSaveResult {
  procedure_order_id: number;
  visit_id: number;
  test_count: number;
  is_new: boolean;
  billing: ProcOrderBilling | null;
}

export interface ProcOrderProps {
  ajaxUrl: string;
  csrfToken: string;
  visitId: number;
  procedureOrderId?: number;
  facilityId: number;
  returnUrl: string;
  returnTo?: string;
}
