/**
 * QC validator for lab result entry — pure, React-state based (D-LAB-VALIDATE). Mirrors the server
 * (LabResultValidationService). No DOM access: callers pass line values and render feedback from
 * the returned checks.
 */

import type { ValidationRules } from './labOpsTypes';

export type ValidationLevel = 'ok' | 'warning' | 'error';

export interface ValidationCheck {
  level: ValidationLevel;
  message?: string;
  suggestedAbnormal?: string | null;
  normalizedValue?: string | null;
}

/** A line's current value, as held in React state. */
export interface LineValueInput {
  seq: number;
  value: string;
}

export interface LineDefaults {
  units: string;
  range: string;
}

export interface ValidateAllResult {
  valid: boolean;
  fieldErrors: Record<string, string>;
  fieldWarnings: Record<string, string>;
  messages: string[];
  firstInvalidSeq: number | null;
}

function parseNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const num = parseFloat(String(value));
  return Number.isNaN(num) ? NaN : num;
}

function normalizeQualitative(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function fieldKeyForSeq(seq: number): string {
  return `line_${seq}_result`;
}

export interface LabResultValidator {
  /** Evaluate a single line's value. Pure. */
  evaluate: (seq: number, value: string, draft: boolean) => ValidationCheck;
  /** Validate every line's value in one pass. Pure. */
  validateAll: (lines: LineValueInput[], draft: boolean) => ValidateAllResult;
  /** Default units / reference range for a line (from QC rules). */
  defaultsForSeq: (seq: number) => LineDefaults;
}

export function createLabResultValidator(rules: ValidationRules | undefined): LabResultValidator {
  const bySeq = rules?.rules_by_seq ?? {};

  function ruleForSeq(seq: number) {
    return bySeq[String(seq)] ?? { type: 'text', label: 'Result', min_length: 1 };
  }

  function evaluate(seq: number, value: string, draft: boolean): ValidationCheck {
    const rule = ruleForSeq(seq);
    const label = rule.procedure_name ?? rule.label ?? 'Result';
    const trimmed = String(value ?? '').trim();
    const type = rule.type ?? 'text';

    if (trimmed === '') {
      if (draft) {
        return { level: 'ok', suggestedAbnormal: null, normalizedValue: '' };
      }
      return {
        level: 'error',
        message: `${label} result is required`,
        suggestedAbnormal: null,
        normalizedValue: '',
      };
    }

    if (type === 'numeric') {
      const num = parseNumber(trimmed);
      if (Number.isNaN(num)) {
        return {
          level: 'error',
          message: `${label} must be numeric`,
          suggestedAbnormal: null,
          normalizedValue: null,
        };
      }
      if (num !== null && rule.min !== undefined && rule.max !== undefined && (num < rule.min || num > rule.max)) {
        return {
          level: 'error',
          message: `${label} must be between ${rule.min} and ${rule.max}`,
          suggestedAbnormal: null,
          normalizedValue: String(num),
        };
      }
      if (
        num !== null
        && rule.warn_min !== undefined
        && rule.warn_max !== undefined
        && (num < rule.warn_min || num > rule.warn_max)
      ) {
        return {
          level: 'warning',
          message: num < rule.warn_min
            ? `${label} below reference range`
            : `${label} above reference range`,
          suggestedAbnormal: num < rule.warn_min ? 'low' : 'high',
          normalizedValue: String(num),
        };
      }
      return { level: 'ok', suggestedAbnormal: null, normalizedValue: String(num) };
    }

    if (type === 'qualitative') {
      const normalized = normalizeQualitative(trimmed);
      const allowed = (rule.allowed ?? []).map(normalizeQualitative);
      if (allowed.length && !allowed.includes(normalized)) {
        return {
          level: 'error',
          message: `${label} must be one of: ${allowed.join(', ')}`,
          suggestedAbnormal: null,
          normalizedValue: null,
        };
      }
      const abnormalValues = (rule.abnormal_values ?? []).map(normalizeQualitative);
      const suggested = abnormalValues.includes(normalized) ? (rule.abnormal_flag ?? 'yes') : null;
      return {
        level: suggested ? 'warning' : 'ok',
        message: suggested ? `${label} is positive — review before release` : '',
        suggestedAbnormal: suggested,
        normalizedValue: normalized,
      };
    }

    if (trimmed.length < (rule.min_length ?? 1)) {
      return {
        level: 'error',
        message: `${label} result is required`,
        suggestedAbnormal: null,
        normalizedValue: trimmed,
      };
    }

    let warning: string | null = null;
    const warnSubstrings = rule.warn_substrings ?? [];
    if (warnSubstrings.length) {
      const lower = trimmed.toLowerCase();
      for (const needle of warnSubstrings) {
        if (!warning && lower.includes(String(needle).toLowerCase())) {
          warning = rule.warn_message ?? `${label} may be abnormal`;
        }
      }
    }

    return {
      level: warning ? 'warning' : 'ok',
      message: warning ?? '',
      suggestedAbnormal: null,
      normalizedValue: trimmed,
    };
  }

  function validateAll(lines: LineValueInput[], draft: boolean): ValidateAllResult {
    const fieldErrors: Record<string, string> = {};
    const fieldWarnings: Record<string, string> = {};
    const messages: string[] = [];
    let firstInvalidSeq: number | null = null;

    for (const line of lines) {
      const check = evaluate(line.seq, line.value, draft);
      const fieldKey = fieldKeyForSeq(line.seq);
      if (check.level === 'error' && check.message) {
        fieldErrors[fieldKey] = check.message;
        messages.push(check.message);
        if (firstInvalidSeq === null) firstInvalidSeq = line.seq;
      } else if (check.level === 'warning' && check.message) {
        fieldWarnings[fieldKey] = check.message;
      }
    }

    return { valid: messages.length === 0, fieldErrors, fieldWarnings, messages, firstInvalidSeq };
  }

  function defaultsForSeq(seq: number): LineDefaults {
    const rule = ruleForSeq(seq);
    return { units: rule.units ?? '', range: rule.reference_range ?? '' };
  }

  return { evaluate, validateAll, defaultsForSeq };
}
