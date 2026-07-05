/**
 * QC validator for lab result entry — port of lab-result-validation.js.
 */

import type { ValidationRules } from './labOpsTypes';

export type ValidationLevel = 'ok' | 'warning' | 'error';

export interface ValidationCheck {
  level: ValidationLevel;
  message?: string;
  suggestedAbnormal?: string | null;
  normalizedValue?: string | null;
}

function parseNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const num = parseFloat(String(value));
  return Number.isNaN(num) ? NaN : num;
}

function normalizeQualitative(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export interface LabResultValidator {
  validateLine: (lineEl: HTMLElement, draft: boolean) => ValidationCheck;
  validateAll: (
    drawerBody: HTMLElement,
    draft: boolean
  ) => { valid: boolean; fieldErrors: Record<string, string>; fieldWarnings: Record<string, string>; messages: string[] };
  applyFieldFeedback: (lineEl: HTMLElement, result: ValidationCheck | null) => void;
  applyDefaults: (lineEl: HTMLElement, seq: number) => void;
  suggestAbnormal: (lineEl: HTMLElement, seq: number, value: string) => void;
  applyServerFieldErrors: (
    drawerBody: HTMLElement,
    fieldErrors: Record<string, string>,
    fieldWarnings: Record<string, string>
  ) => void;
  focusFirstInvalid: (drawerBody: HTMLElement) => void;
}

export function createLabResultValidator(rules: ValidationRules | undefined): LabResultValidator {
  const bySeq = rules?.rules_by_seq ?? {};

  function ruleForSeq(seq: number) {
    return bySeq[String(seq)] ?? { type: 'text', label: 'Result', min_length: 1 };
  }

  function evaluateValue(seq: number, value: string, draft: boolean): ValidationCheck {
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

  function applyFieldFeedback(lineEl: HTMLElement, result: ValidationCheck | null): void {
    const input = lineEl.querySelector<HTMLInputElement>('[data-field="result"]');
    if (!input) return;

    const group = input.closest('.form-group');
    if (!group) return;

    const feedback = group.querySelector<HTMLElement>('.nc-labops-feedback');
    input.classList.remove('is-invalid', 'nc-labops-warning');

    if (!result || result.level === 'ok') {
      if (feedback) {
        feedback.textContent = '';
        feedback.className = 'nc-labops-feedback';
      }
      return;
    }

    if (!feedback) return;

    if (result.level === 'error') {
      input.classList.add('is-invalid');
      feedback.textContent = result.message ?? '';
      feedback.className = 'nc-labops-feedback block text-sm text-[var(--oe-nc-danger,#dc2626)]';
      return;
    }

    input.classList.add('nc-labops-warning');
    feedback.textContent = result.message ?? '';
    feedback.className = 'nc-labops-feedback nc-labops-feedback--warning block';
  }

  function applyDefaults(lineEl: HTMLElement, seq: number): void {
    const rule = ruleForSeq(seq);
    const unitsInput = lineEl.querySelector<HTMLInputElement>('[data-field="units"]');
    const rangeInput = lineEl.querySelector<HTMLInputElement>('[data-field="range"]');
    if (unitsInput && !String(unitsInput.value ?? '').trim() && rule.units) {
      unitsInput.value = rule.units;
    }
    if (rangeInput && !String(rangeInput.value ?? '').trim() && rule.reference_range) {
      rangeInput.value = rule.reference_range;
    }
  }

  function suggestAbnormal(lineEl: HTMLElement, seq: number, value: string): void {
    const result = evaluateValue(seq, value, true);
    if (!result.suggestedAbnormal) return;
    const abnormalSelect = lineEl.querySelector<HTMLSelectElement>('[data-field="abnormal"]');
    if (abnormalSelect && !String(abnormalSelect.value ?? '').trim()) {
      abnormalSelect.value = result.suggestedAbnormal;
    }
  }

  function validateLine(lineEl: HTMLElement, draft: boolean): ValidationCheck {
    const seqInput = lineEl.querySelector<HTMLInputElement>('[data-field="procedure_order_seq"]');
    const resultInput = lineEl.querySelector<HTMLInputElement>('[data-field="result"]');
    if (!seqInput || !resultInput) return { level: 'ok' };
    const seq = parseInt(seqInput.value, 10);
    return evaluateValue(seq, resultInput.value, draft);
  }

  function validateAll(drawerBody: HTMLElement, draft: boolean) {
    const fieldErrors: Record<string, string> = {};
    const fieldWarnings: Record<string, string> = {};
    const messages: string[] = [];

    drawerBody.querySelectorAll<HTMLElement>('.nc-labops-line').forEach((lineEl) => {
      const seqInput = lineEl.querySelector<HTMLInputElement>('[data-field="procedure_order_seq"]');
      if (!seqInput) return;
      const seq = parseInt(seqInput.value, 10);
      const fieldKey = `line_${seq}_result`;
      const check = validateLine(lineEl, draft);
      applyFieldFeedback(lineEl, check);

      if (check.level === 'error' && check.message) {
        fieldErrors[fieldKey] = check.message;
        messages.push(check.message);
      } else if (check.level === 'warning' && check.message) {
        fieldWarnings[fieldKey] = check.message;
      }
    });

    return { valid: messages.length === 0, fieldErrors, fieldWarnings, messages };
  }

  function applyServerFieldErrors(
    drawerBody: HTMLElement,
    fieldErrors: Record<string, string>,
    fieldWarnings: Record<string, string>
  ): void {
    drawerBody.querySelectorAll<HTMLElement>('.nc-labops-line').forEach((lineEl) => {
      const seqInput = lineEl.querySelector<HTMLInputElement>('[data-field="procedure_order_seq"]');
      if (!seqInput) return;
      const fieldKey = `line_${parseInt(seqInput.value, 10)}_result`;
      const message = fieldErrors[fieldKey] ?? fieldWarnings[fieldKey] ?? null;
      if (message) {
        applyFieldFeedback(lineEl, {
          level: fieldErrors[fieldKey] ? 'error' : 'warning',
          message,
        });
      }
    });
  }

  function focusFirstInvalid(drawerBody: HTMLElement): void {
    const first = drawerBody.querySelector<HTMLElement>('.is-invalid');
    if (first) {
      first.focus();
      first.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  return {
    validateLine,
    validateAll,
    applyFieldFeedback,
    applyDefaults,
    suggestAbnormal,
    applyServerFieldErrors,
    focusFirstInvalid,
  };
}
