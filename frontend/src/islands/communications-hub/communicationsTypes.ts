/** Communications Hub (COM) — types mirroring CommunicationsHubService payloads. */

export type CommLens = 'messages' | 'reminders';

export interface ComposeAttachment {
  attachment_id: number;
  attachment_type: number;
  job_id?: string | null;
}

export interface ComposeLaunch {
  open_compose?: boolean;
  attachment?: ComposeAttachment | null;
  pid?: number | null;
}

export interface CommHubSort {
  sortby: string;
  sortorder: 'asc' | 'desc';
}

export interface CommHubPreferences {
  lens: CommLens;
  activity: string;
  scope: 'my' | 'all_users';
  sort: CommHubSort;
}

export interface CommunicationsHubProps {
  ajaxUrl: string;
  csrfToken: string;
  canViewAllUsers: boolean;
  initialLens: CommLens;
  preferences: CommHubPreferences;
  reminderAddUrl: string;
  reminderLogUrl: string;
  legacyComposeUrl: string;
  webroot: string;
  composeLaunch?: ComposeLaunch | null;
}

export type CommComposeMode =
  | 'idle'
  | 'new'
  | 'reply'
  | 'reminder_create'
  | 'reminder_log';

export interface ReminderRecipientOption {
  id: number;
  label: string;
  is_self?: boolean;
}

export interface ReminderDatePreset {
  key: string;
  label: string;
}

export interface ReminderPriorityOption {
  id: number;
  label: string;
}

export interface ReminderForwardSeed {
  reminder_id: number;
  message: string;
  priority: number;
  due_date?: string | null;
  pid?: number | null;
  patient_name?: string | null;
}

export interface ReminderCreateOptions {
  recipients: ReminderRecipientOption[];
  date_presets: ReminderDatePreset[];
  priorities: ReminderPriorityOption[];
  max_message_length: number;
  default_priority: number;
  forward?: ReminderForwardSeed | null;
}

export interface ReminderLogRow {
  id: number;
  sent_at: string;
  sent_at_label?: string | null;
  from_name: string;
  to_name: string;
  patient_name: string;
  message: string;
  due_date: string;
  due_date_label?: string | null;
  processed_at?: string;
  processed_at_label?: string | null;
  processed_by?: string;
}

export interface ReminderLogResult {
  rows: ReminderLogRow[];
  total: number;
  is_admin?: boolean;
  recipients?: ReminderRecipientOption[];
}

export type ReminderLogStatusFilter = 'all' | 'pending' | 'processed';

export interface ReminderLogFilters {
  processed: ReminderLogStatusFilter;
  date_from: string;
  date_to: string;
  sent_by: number[];
  sent_to: number[];
}

export interface ComposeListOption {
  id: string;
  label: string;
}

export interface ComposeUserOption {
  username: string;
  label: string;
}

export interface ComposeReplySeed {
  reply_note_id: number;
  note_type: string;
  message_status: string;
  pid?: number | null;
  patient_name?: string | null;
  assigned_to: string[];
}

export interface ComposeOptions {
  note_types: ComposeListOption[];
  message_statuses: ComposeListOption[];
  users: ComposeUserOption[];
  default_status: string;
  show_due_date: boolean;
  reply?: ComposeReplySeed | null;
}

export interface HubCounts {
  messages_active: number;
  reminders_in_window: number;
  reminders_due_5d?: number;
  envelope_total?: number;
}

export interface MessageListRow {
  id: number;
  patient_name: string;
  type: string;
  from_name: string;
  date: string;
  date_display: string;
  status: string;
  is_unread: boolean;
  patient_unassigned?: boolean;
}

export interface ReminderListRow {
  id: number;
  pid: number;
  patient_name: string;
  from_name: string;
  due_date: string;
  due_display: string;
  urgency: string;
  urgency_label: string;
  preview: string;
}

export interface MessageDetail {
  id: number;
  patient_name: string;
  type: string;
  from_name: string;
  date: string;
  date_display: string;
  status: string;
  pid?: number | null;
  patient_unassigned?: boolean;
  can_assign_patient?: boolean;
  chart_url?: string;
  can_reply: boolean;
  legacy_reply_url?: string;
  can_mark_done: boolean;
  can_delete?: boolean;
  can_change_status?: boolean;
  message_statuses?: ComposeListOption[];
  is_supervisory_read?: boolean;
  supervisory_banner?: string;
  thread_html: string;
}

export interface MessagesListResult {
  rows: MessageListRow[];
  total: number;
  begin: number;
  limit: number;
}

export interface RemindersListResult {
  rows: ReminderListRow[];
  total: number;
}

export type CommListRow = MessageListRow | ReminderListRow;

export const COMM_PAGE_SIZE = 25;
export const COMM_POLL_MS = 60_000;
export const COMM_SEARCH_DEBOUNCE_MS = 300;
