export interface OutreachProps {
  ajaxUrl: string;
  csrfToken: string;
  webroot?: string;
  legacyUrl?: string;
}

export interface OutreachPreset {
  id: string;
  label: string;
  filters: Record<string, unknown>;
}

export interface OutreachPresetsData {
  presets: { builtins?: OutreachPreset[] };
  gateway_configured: boolean;
}

export interface OutreachPreviewData {
  channel: string;
  recipient_count: number;
  reachable_count: number;
  capped: boolean;
  cap: number;
  filter_summary: string;
  sample: { name: string; contact: string }[];
}

export interface OutreachQueueResult {
  status: string;
  note: string;
  recipient_count: number;
  reachable_count: number;
}

export interface OutreachCampaign {
  id: number;
  channel: string;
  subject: string;
  filter_summary: string;
  recipient_count: number;
  reachable_count: number;
  status: string;
  delivery_note: string;
  created_at: string;
}

export interface OutreachHistoryData {
  campaigns: OutreachCampaign[];
}
