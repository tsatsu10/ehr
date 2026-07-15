import { describe, expect, it } from 'vitest';
import { createLabResultValidator, fieldKeyForSeq } from './labResultValidation';
import type { ValidationRules } from './labOpsTypes';

const rules: ValidationRules = {
  rules_by_seq: {
    1: { type: 'numeric', label: 'Haemoglobin', min: 3, max: 25, warn_min: 7, warn_max: 18, units: 'g/dL', reference_range: '7–18' },
    2: { type: 'qualitative', label: 'Malaria RDT', allowed: ['negative', 'positive'], abnormal_values: ['positive'], abnormal_flag: 'yes' },
  },
};

describe('createLabResultValidator (pure, no DOM)', () => {
  const validator = createLabResultValidator(rules);

  it('flags a value below the reference range as a warning and suggests low', () => {
    const check = validator.evaluate(1, '6', false);
    expect(check.level).toBe('warning');
    expect(check.suggestedAbnormal).toBe('low');
    expect(check.message).toMatch(/below reference range/i);
  });

  it('rejects a non-numeric value with an error', () => {
    expect(validator.evaluate(1, 'abc', false).level).toBe('error');
  });

  it('treats empty as ok in draft mode but an error on final save', () => {
    expect(validator.evaluate(1, '', true).level).toBe('ok');
    expect(validator.evaluate(1, '', false).level).toBe('error');
  });

  it('rejects a qualitative value outside the allowed set', () => {
    expect(validator.evaluate(2, 'maybe', false).level).toBe('error');
    expect(validator.evaluate(2, 'positive', false).suggestedAbnormal).toBe('yes');
  });

  it('validateAll reports the first invalid line and per-field errors', () => {
    const result = validator.validateAll(
      [
        { seq: 1, value: '' },
        { seq: 2, value: 'negative' },
      ],
      false
    );
    expect(result.valid).toBe(false);
    expect(result.firstInvalidSeq).toBe(1);
    expect(result.fieldErrors[fieldKeyForSeq(1)]).toMatch(/required/i);
  });

  it('exposes default units and reference range from the rule', () => {
    expect(validator.defaultsForSeq(1)).toEqual({ units: 'g/dL', range: '7–18' });
  });
});
