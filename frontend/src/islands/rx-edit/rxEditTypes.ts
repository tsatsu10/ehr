export interface RxEditProps {
  ajaxUrl: string;
  csrfToken: string;
  visitId: number;
  prescriptionId?: number;
  returnUrl: string;
}

export interface RxOption {
  id: string;
  title: string;
}

export interface ExistingPrescription {
  prescription_id: number;
  drug_name: string;
  dosage: string;
  quantity: string;
  route: string;
  interval: string;
  refills: number;
  prn: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface PrescriptionDraft {
  prescription_id: number;
  drug_name: string;
  drug_id: number;
  dosage: string;
  quantity: string;
  route: string;
  interval: string;
  refills: number;
  note: string;
  sig: string;
  prn: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface RxFormData {
  visit_id: number;
  pid: number;
  encounter: number;
  facility_id: number;
  patient_name: string;
  allergies: string[];
  existing_prescriptions: ExistingPrescription[];
  route_options: RxOption[];
  interval_options: RxOption[];
  form_options: RxOption[];
  currency_symbol: string;
  prescription: PrescriptionDraft | null;
}

export interface DrugSearchRow {
  drug_id: number;
  name: string;
  display_name: string;
  form: string;
  route: string;
  allergy_match: boolean;
}

export interface RxSaveResult {
  prescription_id: number;
  action: 'created' | 'updated';
  existing_prescriptions: ExistingPrescription[];
}
