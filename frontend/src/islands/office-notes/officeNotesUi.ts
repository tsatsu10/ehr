import { t } from '@core/i18n';
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

/**
 * Filter segments for the notes SegmentedControl. A function, not a
 * module-scope constant: t() must run at render time, after the locale
 * dictionary has loaded (module scope evaluates at import, before it).
 */
export function officeNoteFilters(): { id: OfficeNoteFilter; label: string }[] {
  return [
    { id: 'active', label: t('Active') },
    { id: 'archived', label: t('Archived') },
    { id: 'all', label: t('All') },
  ];
}
