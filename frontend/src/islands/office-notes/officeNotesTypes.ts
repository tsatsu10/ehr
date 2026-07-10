export type OfficeNoteFilter = 'active' | 'archived' | 'all';

export interface OfficeNote {
  id: number;
  body: string;
  user: string;
  /** MySQL datetime string, e.g. "2026-07-10 14:33:00". */
  date: string;
  active: boolean;
  pinned: boolean;
}

export interface OfficeNotesListResponse {
  notes: OfficeNote[];
  total: number;
  offset: number;
  page_size: number;
  filter: OfficeNoteFilter;
}

export interface OfficeNotesProps {
  ajaxUrl: string;
  csrfToken: string;
  webroot?: string;
  /** Stock office_comments_full.php — reachable until parity sign-off. */
  legacyUrl?: string;
}
