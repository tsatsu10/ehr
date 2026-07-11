import type { OfficeNoteFilter } from './officeNotesTypes';

/**
 * Format a MySQL datetime ("Y-m-d H:i:s") as regional DD/MM/YYYY HH:mm.
 * Island-local (matches the communications-hub reminderDateUtils precedent) —
 * there is no shared @core datetime formatter to reuse.
 */
export function formatNoteDateTime(mysqlDateTime: string): string {
  if (!mysqlDateTime) return '';
  // Parse without timezone shifting: treat the stored value as local wall-clock.
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(mysqlDateTime);
  if (!match) return mysqlDateTime;
  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export const OFFICE_NOTE_FILTERS: { id: OfficeNoteFilter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
];
