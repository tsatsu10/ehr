/** Map COM reminder date-preset keys to YYYY-MM-DD (mirrors dated_reminders_add.php). */

export function dueDateFromPreset(key: string): string | null {
  const match = key.match(/^(\d+)_(day|week|month|year)$/);
  if (!match) {
    return null;
  }

  const period = Number.parseInt(match[1], 10);
  const span = match[2];
  const date = new Date();

  if (span === 'day') {
    date.setDate(date.getDate() + period);
  } else if (span === 'week') {
    date.setDate(date.getDate() + period * 7);
  } else if (span === 'month') {
    date.setMonth(date.getMonth() + period);
  } else if (span === 'year') {
    date.setMonth(date.getMonth() + period * 12);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function todayIsoDate(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
