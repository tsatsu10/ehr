/** Format a stored MySQL date/datetime as regional DD/MM/YYYY (no timezone shift). */
export function formatDocDate(value: string): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Human-readable file size from a byte count. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function isImageMime(mimetype: string): boolean {
  return mimetype.startsWith('image/');
}

export function isPdfMime(mimetype: string): boolean {
  return mimetype === 'application/pdf';
}

/** Only PDFs and images render inline; anything else is offered as a download link. */
export function isPreviewable(mimetype: string): boolean {
  return isImageMime(mimetype) || isPdfMime(mimetype);
}
