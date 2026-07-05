import { cn } from '@/lib/utils';

export type DeskCalloutTone = 'warn' | 'error' | 'info' | 'success';

const deskCalloutToneClass: Record<DeskCalloutTone, string> = {
  warn: 'nc-warn-callout border-amber-300 bg-amber-50 text-amber-900',
  error: 'nc-error-callout border-red-300 bg-red-50 text-red-900',
  info: 'nc-info-callout border-blue-300 bg-blue-50 text-[#1e3a5f]',
  success: 'nc-success-callout border-green-300 bg-green-50 text-green-900',
};

/** Shared desk callout shell — warn/error/info/success boxes across desks. */
export function deskCalloutClass(tone: DeskCalloutTone, className?: string): string {
  return cn('rounded-lg border px-4 py-3', deskCalloutToneClass[tone], className);
}
