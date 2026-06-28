import type { PillVariant } from '@core/types';

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function completionVariant(score: number, threshold = 70): PillVariant {
  if (score >= threshold) return 'success';
  if (score >= threshold - 15) return 'warning';
  return 'danger';
}
