export type SchedulingLens = 'calendar' | 'flow' | 'recalls';

export interface SchedulingOption {
  id: number;
  label: string;
}

export interface SchedulingFilters {
  facilityId: number;
  providerId: number;
  date: string;
}

export interface SchedulingProps {
  ajaxUrl: string;
  csrfToken: string;
  moduleUrl: string;
  frontDeskUrl: string;
  visitBoardUrl: string;
  queueBridgeUrl: string;
  facilityId: number;
  authUserId: number;
  initialLens: SchedulingLens;
  initialDate: string;
  initialProviderId: number;
  canBook: boolean;
  facilities: SchedulingOption[];
  providers: SchedulingOption[];
  webroot: string;
  labels?: SchedulingLabels;
}

export interface SchedulingLabels {
  bookAppointment: string;
  newRecall: string;
  allProviders: string;
  showFilters: string;
  hideFilters: string;
  today: string;
  previousDay: string;
  nextDay: string;
  previousWeek: string;
  nextWeek: string;
  previousMonth: string;
  nextMonth: string;
  flowBoardMode2Hint: string;
  calendarAppointments: string;
  loadingCalendar: string;
  loadingFlowBoard: string;
  lensCalendar: string;
  lensFlow: string;
  lensRecalls: string;
  calendarNoAppointments: string;
  calendarSlotIntervals: string;
  calendarOn: string;
  calendarFrom: string;
  calendarTo: string;
  calendarAppointmentSingular: string;
  calendarDayGrid: string;
  calendarAgenda: string;
  calendarWeek: string;
  calendarMonth: string;
  frontDesk: string;
  close: string;
  flowBoardBoard: string;
  flowBoardList: string;
  flowBoardNoPatients: string;
  flowBoardNext: string;
  flowBoardCheckIn: string;
  flowBoardRoomPrefix: string;
  moveLaneLeft: string;
  moveLaneRight: string;
  recallOverdue: string;
  recallDue: string;
  recallUpcoming: string;
  recallCompleted: string;
  recallSearchPlaceholder: string;
  loadingRecalls: string;
  recallNoRows: string;
  recallLogOutcome: string;
  recallBookAppt: string;
  recallSnooze: string;
  recallEdit: string;
  recallDelete: string;
  errorLoadFlowBoard: string;
  errorStatusUpdate: string;
  errorRoomUpdate: string;
  errorLoadCalendar: string;
  errorMoveAppointment: string;
  errorResizeAppointment: string;
  errorLoadRecalls: string;
  errorOpenBooking: string;
  errorBookingFailed: string;
  errorSaveFailed: string;
  errorSnoozeFailed: string;
  errorDeleteFailed: string;
  errorSendReminderFailed: string;
  bookSheetTitle: string;
  bookSheetAria: string;
  cancel: string;
  saveAppointment: string;
  saving: string;
  bookingHint: string;
  patient: string;
  provider: string;
  visitType: string;
  time: string;
  durationMin: string;
  comments: string;
  bookingValidation: string;
  nextFreeTimes: string;
  providerColors: string;
  shortcutHint: string;
  noFreeSlots: string;
  freeSlotsError: string;
  retry: string;
  recallSheetNew: string;
  recallSheetEdit: string;
  recallSheetAria: string;
  saveRecall: string;
  recallHint: string;
  dueDate: string;
  reason: string;
  facility: string;
  recallValidation: string;
  createRecallTooltip: string;
  bookTooltip: string;
  requiresAclTooltip: string;
  flowBoardUpdatedAt: string;
  recurringTrackerDisabled: string;
  recurringScopeTitle: string;
  recurringScopePrompt: string;
  recurringScopeCurrent: string;
  recurringScopeFuture: string;
  recurringScopeAll: string;
  noClinicalVisit: string;
  fix: string;
  roomFor: string;
  listColTime: string;
  listColPatient: string;
  listColStatus: string;
  listColWait: string;
  listColActions: string;
  reasonPlaceholder: string;
  deleteRecallConfirm: string;
  weekMoreEvents: string;
  resizeAppointmentAria: string;
  crossLinkViewAppointment: string;
  crossLinkViewRecalls: string;
  crossLinkFlowBoard: string;
  outcomeModalTitle: string;
  outcomeModalConfirm: string;
  outcomeModalStatus: string;
  outcomeModalNote: string;
  outcomeStatusContacted: string;
  outcomeStatusDeclined: string;
  outcomeStatusUnreachable: string;
  outcomeStatusCompleted: string;
  outcomeStatusSnoozed: string;
  recallColPatient: string;
  recallColDue: string;
  recallColReason: string;
  recallColStatus: string;
  recallColContact: string;
  recallColActions: string;
  filteredPatientPid: string;
  recallType: string;
  recallSendReminder: string;
  notifyPatientTitle: string;
  notifyPatientBody: string;
  notifyPatientConfirm: string;
  notifyPatientSkip: string;
  notifyPatientAbort: string;
  notifyMoveLabel: string;
  notifyResizeLabel: string;
  flowBoardRunningLate: string;
  recallLastSeenPrefix: string;
  recallNeverSeen: string;
  calendarBlockTag: string;
  changePatient: string;
  whenLabel: string;
  cancelAppointmentAction: string;
  cancelAppointmentConfirm: string;
  cancelAppointmentKeep: string;
  errorCancelAppointment: string;
  repeatLabel: string;
  repeatNone: string;
  repeatWeekly: string;
  repeatBiweekly: string;
  repeatMonthly: string;
  repeatUntilLabel: string;
  repeatUntilRequired: string;
}

export const LENS_LABELS: Record<SchedulingLens, string> = {
  calendar: 'Calendar',
  flow: 'Flow Board',
  recalls: 'Recalls',
};

export const ALL_PROVIDERS_ID = 0;

export interface FlowBoardCard {
  pc_eid: number;
  pid: number;
  pubpid: string;
  patient_name: string;
  appt_time_label: string | null;
  category_label: string;
  status: string;
  status_label: string;
  room: string;
  status_since: string | null;
  minutes_in_status: number;
  alert_minutes: number;
  alert_level: 'ok' | 'warn' | 'over';
  /** Booked but not arrived past the appointment time (today only). */
  running_late?: boolean;
  is_recurring: boolean;
  has_tracker: boolean;
  next_status: string | null;
  check_in_status: string | null;
  queue_bridge_ex01: boolean;
  queue_bridge_fix_url: string | null;
}

export interface FlowBoardLane {
  lane_key?: string;
  status: string;
  label: string;
  count: number;
  cards: FlowBoardCard[];
}

export interface FlowBoardPayload {
  date: string;
  facility_id: number;
  provider_id: number | null;
  lanes: FlowBoardLane[];
  revision: string;
  poll_interval_ms: number;
  can_advance: boolean;
  queue_bridge_enabled: boolean;
  unchanged?: boolean;
}

export type FlowBoardPollResult =
  | FlowBoardPayload
  | {
    unchanged: true;
    revision: string;
    poll_interval_ms: number;
  };

export interface CalendarEvent {
  pc_eid: number;
  pid: number;
  pubpid: string;
  patient_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  provider_id: number;
  provider_label: string;
  category_id: number;
  /** The visit type / reason for this appointment (from pc_title). */
  category_label: string;
  /** Matched visit type id (0 when it doesn't map to a current type / is a block). */
  visit_type_id?: number;
  /** True for clinic/group blocks with no patient (read-only chip). */
  is_block?: boolean;
  status: string;
  status_label: string;
  is_recurring: boolean;
  comments: string;
}

export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarDayPayload {
  view?: CalendarView;
  anchor_date?: string;
  start_date?: string;
  end_date?: string;
  date: string;
  facility_id: number;
  provider_id: number | null;
  interval_minutes: number;
  /** Clinic day bounds (hour 0–24) so the grid spans real hours, not a fixed 08–18. */
  open_hour?: number;
  close_hour?: number;
  events: CalendarEvent[];
  /** Bookable visit types (Admin → Clinic Setup) — same list Front Desk's Start Visit uses */
  categories: SchedulingOption[];
  /** Facility's default visit type id (server-resolved, falls back to the first entry) */
  default_visit_type_id?: number;
  providers: SchedulingOption[];
  /** providerId → "#rrggbb" (admin pick or palette default) — the provider dot for who */
  provider_colors?: Record<number, string>;
  /** visitTypeId → "#rrggbb" (palette by type) — the chip fill colour */
  visit_type_colors?: Record<number, string>;
  revision: string;
  poll_interval_ms: number;
  can_book: boolean;
  unchanged?: boolean;
  patient_notify?: {
    medex_enabled: boolean;
  };
}

export type CalendarPollResult =
  | CalendarDayPayload
  | {
    unchanged: true;
    revision: string;
    poll_interval_ms: number;
  };

export interface CalendarBookingDraft {
  date: string;
  time: string;
  providerId: number;
  pid: number;
  patientLabel: string;
  visitTypeId: number;
  durationMinutes: number;
  comments: string;
  recallId?: number;
}

export type RecallBucket = 'overdue' | 'due' | 'upcoming' | 'completed';

export type RecallStatus =
  | 'open'
  | 'contacted'
  | 'scheduled'
  | 'completed'
  | 'declined'
  | 'unreachable'
  | 'snoozed';

export interface RecallRow {
  recall_id: number;
  pid: number;
  pubpid: string;
  patient_name: string;
  due_date: string;
  days_delta: number;
  bucket: RecallBucket;
  reason: string;
  provider_id: number;
  facility_id: number;
  status: RecallStatus;
  status_label: string;
  produced_eid: number | null;
  produced_event_date: string;
  outcome_note: string;
  contact: string;
  /** Patient's last encounter date (Y-m-d, '' when never seen). */
  last_seen_date?: string;
  /** Human "3 months ago" for last_seen_date ('' when never seen). */
  last_seen_label?: string;
  recall_type?: string;
  recall_type_label?: string;
  messaging?: {
    available: boolean;
    last_channel: string | null;
    last_status: string | null;
  };
}

/** Recall type ids are a string enum server-side (SchedulingRecallsService::RECALL_TYPES), unlike SchedulingOption's numeric id. */
export interface RecallTypeOption {
  id: string;
  label: string;
}

export interface RecallsWorklistPayload {
  bucket: RecallBucket;
  facility_id: number;
  provider_id: number | null;
  today: string;
  counts: Record<RecallBucket, number>;
  rows: RecallRow[];
  can_manage: boolean;
  providers: SchedulingOption[];
  recall_types?: RecallTypeOption[];
  messaging_enabled?: boolean;
}

export interface RecallFormDraft {
  recallId: number;
  pid: number;
  patientLabel: string;
  dueDate: string;
  reason: string;
  providerId: number;
  facilityId: number;
  recallType?: string;
}
