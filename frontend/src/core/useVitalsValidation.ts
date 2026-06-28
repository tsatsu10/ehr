/**
 * useVitalsValidation — pure TypeScript port of vitals-form-validation.js
 *
 * No DOM manipulation: returns validation state as plain objects so
 * React components can render feedback without imperative DOM writes.
 */

import { useMemo } from 'react';
import type { FieldValidation, VitalName, VitalsData, VitalsRules } from './types';

export type FieldValidations = Partial<Record<VitalName, FieldValidation>>;

export interface VitalsValidationResult {
  /** true when no error-level issues are present */
  valid: boolean;
  /** per-field validation state */
  fields: FieldValidations;
  /** error messages collected across all fields */
  errorMessages: string[];
  /** warning messages (saveable but should be reviewed) */
  warnMessages: string[];
}

function parseNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = parseFloat(String(value).trim());
  return Number.isNaN(n) ? null : n;
}

function validateField(
  name: VitalName,
  value: string | number | undefined,
  rules: VitalsRules
): FieldValidation {
  const def = rules.fields[name];
  if (!def) return null;

  // API may return numeric values — coerce to string before trimming
  const trimmed = String(value ?? '').trim();
  const isRequired = def.required || (rules.required ?? []).includes(name);

  if (trimmed === '') {
    return isRequired
      ? { level: 'error', message: `${def.label} is required` }
      : null;
  }

  const num = parseNumber(trimmed);

  if (num === null) {
    return { level: 'error', message: `${def.label} must be numeric` };
  }

  if (num < def.min || num > def.max) {
    return {
      level: 'error',
      message: `${def.label} must be between ${def.min} and ${def.max}`,
    };
  }

  if (
    def.warn_min !== undefined &&
    def.warn_max !== undefined &&
    (num < def.warn_min || num > def.warn_max)
  ) {
    return {
      level: 'warning',
      message: def.warn_message ?? `${def.label} outside normal range`,
    };
  }

  return { level: 'ok' };
}

/**
 * Validate all vitals fields against the rules payload.
 * Pure function — no side effects.
 */
export function validateVitals(
  vitals: VitalsData,
  rules: VitalsRules
): VitalsValidationResult {
  const fields: FieldValidations = {};
  const errorMessages: string[] = [];
  const warnMessages: string[] = [];

  for (const name of Object.keys(rules.fields) as VitalName[]) {
    const result = validateField(name, vitals[name], rules);
    fields[name] = result;
    if (result?.level === 'error') errorMessages.push(result.message);
    if (result?.level === 'warning') warnMessages.push(result.message);
  }

  return { valid: errorMessages.length === 0, fields, errorMessages, warnMessages };
}

/**
 * Memoised hook — re-runs validation only when vitals values or rules change.
 *
 * We derive a stable string key from the vitals map so the memo only fires
 * when a value actually changes, not on every render due to object identity.
 */
export function useVitalsValidation(
  vitals: VitalsData,
  rules: VitalsRules | undefined
): VitalsValidationResult {
  // Stable string key derived from vitals values — avoids object-identity churn.
  const vitalsKey = Object.keys(vitals).sort().map((k) => `${k}:${vitals[k as VitalName]}`).join(',');

  return useMemo(() => {
    if (!rules) return { valid: true, fields: {}, errorMessages: [], warnMessages: [] };
    return validateVitals(vitals, rules);
  // vitalsKey is a stable primitive derived from vitals — safe as a dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitalsKey, rules]);
}
