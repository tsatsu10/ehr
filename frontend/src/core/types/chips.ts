/**
 * Search / preview chip payloads (appointments, recalls).
 */

export interface AppointmentTodayChip {
  pc_eid?: number;
  appt_date?: string;
  start_time_label?: string;
  provider_name?: string;
  tooltip?: string;
  default_visit_type_id?: number;
}

export interface RecallDueChip {
  recall_id: number;
  due_date: string;
  days_delta: number;
  reason?: string;
  status?: string;
  worklist_url: string;
  label: string;
}
