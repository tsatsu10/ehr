export type PharmOpsTab = 'pending_dispense' | 'low_stock' | 'write_off' | 'reports';

export interface PharmOpsReportItem {
  id: string;
  label: string;
  description?: string;
  embed_url: string;
}

export interface PharmOpsReportCatalog {
  default_report_id?: string;
  reports: PharmOpsReportItem[];
}

export interface PharmOpsHubProps {
  ajaxUrl: string;
  csrfToken: string;
  moduleUrl: string;
  pharmacyDeskUrl: string;
  visitBoardUrl?: string;
  facilityId?: number | string;
  initialTab: PharmOpsTab;
  canDispense: boolean;
  canReceive?: boolean;
  canDestroy?: boolean;
  canManageCatalog?: boolean;
  canViewReports?: boolean;
  webroot: string;
}

export interface WorklistCounts {
  pending_dispense?: number;
  low_stock?: number;
  write_off?: number;
}

export interface WorklistRow {
  row_type?: 'pending_dispense';
  prescription_id: number;
  pid: number;
  patient_label: string;
  patient_name?: string;
  mrn?: string;
  visit_id?: number | null;
  queue_number?: number | string | null;
  is_urgent?: boolean;
  drug_name: string;
  qty_ordered: number;
  qty_dispensed: number;
  dispense_status: 'pending' | 'partial';
  status_label: string;
  stock_status?: string;
  ordered_display?: string | null;
  can_open_pharmacy_desk?: boolean;
  pharmacy_desk_url?: string | null;
  patient_chart_url?: string;
}

export interface LowStockRow {
  row_type: 'low_stock';
  drug_id: number;
  drug_name: string;
  on_hand: number;
  reorder_point: number;
  stock_status: 'low' | 'out_of_stock' | 'in_stock';
  status_label: string;
  qoh_display?: string;
  receive_stock_url?: string | null;
}

export interface WriteOffRow {
  row_type: 'write_off';
  drug_id: number;
  inventory_id: number;
  drug_name: string;
  lot_number: string;
  manufacturer?: string;
  on_hand: number;
  expiration: string;
  lot_status: 'expired' | 'expiring_soon';
  status_label: string;
  warehouse?: string | null;
  qoh_display?: string;
}

export type PharmOpsWorklistRow = WorklistRow | LowStockRow | WriteOffRow;

export function isLowStockRow(row: PharmOpsWorklistRow): row is LowStockRow {
  return row.row_type === 'low_stock';
}

export function isWriteOffRow(row: PharmOpsWorklistRow): row is WriteOffRow {
  return row.row_type === 'write_off';
}

export function isDispenseRow(row: PharmOpsWorklistRow): row is WorklistRow {
  return !isLowStockRow(row) && !isWriteOffRow(row);
}

export interface WorklistData {
  rows: PharmOpsWorklistRow[];
  counts: WorklistCounts;
  can_dispense?: boolean;
  can_receive?: boolean;
  can_destroy?: boolean;
  can_print_rx?: boolean;
  can_print_dispense_label?: boolean;
  expiry_warn_days?: number;
  last_updated?: string;
}

export interface ReceiveWarehouse {
  id: string;
  title: string;
}

export interface ReceiveForm {
  warehouses: ReceiveWarehouse[];
  default_warehouse_id?: string;
  currency_symbol?: string;
  drug?: {
    drug_id: number;
    drug_name: string;
    on_hand?: number;
  } | null;
  can_receive?: boolean;
}

export interface ReceiveSaveResult {
  sale_id: number;
  inventory_id: number;
  drug_id: number;
  lot_number: string;
  quantity: number;
  on_hand: number;
}

export interface ReceiveInitialContext {
  drugId?: number;
  drugName?: string;
}

export interface DestroyLotContext {
  drugId: number;
  inventoryId: number;
  drugName?: string;
  lotNumber?: string;
}

export interface DestroyForm {
  drug_id: number;
  inventory_id: number;
  lot?: WriteOffRow;
  default_destroy_date?: string;
  can_destroy?: boolean;
}

export interface DestroyConfirmResult {
  inventory_id: number;
  drug_id: number;
  lot_number: string;
  destroy_date: string;
}

export interface PharmSetupStatus {
  facility_id?: number;
  inhouse_pharmacy?: number;
  inhouse_pharmacy_label?: string;
  warehouse_count?: number;
  warehouses?: ReceiveWarehouse[];
  default_warehouse_id?: string;
  drug_count?: number;
  has_starter_formulary?: boolean;
  starter_csv_available?: boolean;
  can_manage_catalog?: boolean;
  admin_hub_url?: string;
  fee_schedule_hint?: string;
}

export interface PharmControlledCatalogDrug {
  drug_id: number;
  drug_name: string;
  is_controlled: boolean;
  controlled_schedule_code?: string | null;
}

export interface PharmControlledCatalogData {
  drugs: PharmControlledCatalogDrug[];
}

export interface FefoLot {
  lot_number?: string;
  expiration?: string;
  on_hand?: number;
  warehouse?: string;
}

export interface DispenseInventory {
  on_hand?: number;
  can_fulfill?: boolean;
  stock_status?: string;
  fefo_lot?: FefoLot | null;
  message?: string | null;
}

export interface DispenseForm {
  prescription_id: number;
  pid: number;
  encounter_id: number;
  patient?: {
    display_name?: string;
    patient_label?: string;
    mrn?: string;
  };
  visit?: {
    visit_id?: number | null;
    queue_number?: number | null;
    visit_date?: string;
  };
  drug?: {
    drug_id?: number;
    drug_name?: string;
    sig?: string;
    qty_ordered?: number;
    qty_dispensed?: number;
    qty_remaining?: number;
    default_quantity?: number;
  };
  inventory?: DispenseInventory;
  fee?: {
    amount?: number;
    unit_amount?: number;
    currency_symbol?: string;
  };
  safety?: {
    allergies?: string[];
    allergy_warning?: boolean;
  };
  can_print_label?: boolean;
}

export interface DispenseConfirmResult {
  prescription_id: number;
  sale_id: number;
  qty_dispensed: number;
  dispense_status: string;
  drug_name?: string;
  can_print_label?: boolean;
}

export interface OtcDrugSearchRow {
  drug_id: number;
  drug_name: string;
  on_hand?: number;
  stock_status?: string;
}

export interface OtcDrugSearchData {
  query?: string;
  rows: OtcDrugSearchRow[];
}

export interface OtcSaleForm {
  pid: number;
  encounter_id: number;
  patient?: {
    display_name?: string;
    patient_label?: string;
    mrn?: string;
  };
  visit?: {
    visit_id?: number | null;
    queue_number?: number | null;
    visit_date?: string | null;
  };
  drug?: {
    drug_id?: number;
    drug_name?: string;
    default_quantity?: number;
  };
  inventory?: DispenseInventory;
  fee?: {
    amount?: number;
    unit_amount?: number;
    currency_symbol?: string;
  };
  safety?: {
    allergies?: string[];
    allergy_warning?: boolean;
  };
  encounter_required?: boolean;
  encounter_warning?: string | null;
}

export interface OtcSaleConfirmResult {
  sale_id: number;
  pid: number;
  encounter_id: number;
  drug_id: number;
  drug_name?: string;
  quantity: number;
}

export interface OtcSaleInitialContext {
  pid?: number;
  encounterId?: number;
  patientLabel?: string;
  mrn?: string;
}

export const PHARM_OPS_POLL_MS = 45_000;
