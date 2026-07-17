/**
 * Patient identity, preview, and completion types shared across desks.
 */

export interface PatientIdentity {
  pid: number;
  pubpid: string;
  display_name: string;
  sex: string;
  age_years: string;
}

export interface PatientCompletion {
  score: number;
  billing_threshold: number;
  missing_labels?: string[];
  chart_url?: string;
  chart_open_url?: string;
}

export interface PatientVitalsToday {
  summary?: string;
  vitals_missing_today?: boolean;
  vitals_abnormal_today?: boolean;
}

export interface PatientPreview {
  identity: PatientIdentity;
  completion: PatientCompletion;
  safety?: {
    allergies_severe?: string[];
    allergies_undocumented?: boolean;
    pregnant?: boolean;
    problem_count?: number;
    allergy_count?: number;
  };
  vitals_today?: PatientVitalsToday;
  banner_mrd_deep_links?: boolean;
  allergy_count_chip?: boolean;
}
