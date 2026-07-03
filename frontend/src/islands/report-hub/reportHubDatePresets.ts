import { localDateString } from '@islands/daily-reports/reportsFormatters';

export type ReportDatePreset = 'month_to_date' | 'today' | 'this_week' | 'this_month';

export function reportDateRangeForPreset(preset: ReportDatePreset): { from: string; to: string } {
  const today = localDateString();
  if (preset === 'today') {
    return { from: today, to: today };
  }

  if (preset === 'this_month') {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }

  if (preset === 'this_week') {
    const date = new Date(`${today}T12:00:00`);
    const day = date.getDay();
    const diff = day === 0 ? 6 : day - 1;
    date.setDate(date.getDate() - diff);
    const from = date.toISOString().slice(0, 10);
    return { from, to: today };
  }

  return reportDateRangeForPreset('this_month');
}
