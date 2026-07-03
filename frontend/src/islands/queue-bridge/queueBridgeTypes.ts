export type QueueBridgeLens = 'action' | 'info' | 'resolved';

export interface QueueBridgeLinks {
  visit_board_url: string;
  front_desk_url: string;
  flow_board_url: string;
  scheduling_url: string;
  reports_url: string;
}

export interface QueueBridgeRow {
  exception_code: string;
  severity: string;
  pid: number;
  pc_eid: number | null;
  visit_id: number | null;
  patient_name: string;
  queue_number?: number | null;
  appt_time_label?: string | null;
  summary: string;
  detail?: string;
  available_actions?: string[];
  can_dismiss?: boolean;
  resolved_at?: string;
  links?: QueueBridgeLinks;
}

export interface QueueBridgeListPayload {
  lens: QueueBridgeLens;
  snapshot_date: string;
  counts: {
    action: number;
    info: number;
    resolved: number;
  };
  rows: QueueBridgeRow[];
  page: number;
  has_more: boolean;
  can_resolve: boolean;
  can_dismiss: boolean;
  links: QueueBridgeLinks;
  eod_block_enabled: boolean;
}

export interface QueueBridgeProps {
  ajaxUrl: string;
  csrfToken: string;
  moduleUrl: string;
  visitBoardUrl: string;
  frontDeskUrl: string;
  flowBoardUrl: string;
  schedulingUrl: string;
  reportsUrl: string;
  facilityId: number;
  initialLens: QueueBridgeLens;
  canResolve: boolean;
  canDismiss: boolean;
  webroot: string;
}

export const LENS_LABELS: Record<QueueBridgeLens, string> = {
  action: 'Exceptions',
  info: 'Recurring info',
  resolved: 'Resolved today',
};

export const ACTION_LABELS: Record<string, string> = {
  start_visit_checkin: 'Start visit & check in',
  mark_arrived: 'Mark appointment arrived',
  link_appointment: 'Link appointment',
  cancel_visit: 'Cancel visit',
  unlink_appointment: 'Unlink appointment',
  relink_nearest_appointment: 'Re-link nearest appointment',
  open_flow_board: 'Open Flow Board',
  open_scheduling: 'Open Scheduling & Flow',
  open_visit_board: 'Open Visit Board',
  dismiss: 'Dismiss',
};
