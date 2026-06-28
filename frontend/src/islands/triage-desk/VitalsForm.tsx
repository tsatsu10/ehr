/**
 * VitalsForm — controlled vitals input form with per-field validation feedback.
 *
 * Mirrors renderVitalsForm() + bindVitalsValidation() from triage.js,
 * implemented as a controlled React form with the useVitalsValidation hook.
 */

import { useRef } from 'react';
import type { VitalsData, VitalsRules, VitalName } from '@core/types';
import { VITAL_ORDER } from '@core/types';
import type { FieldValidations } from '@core/useVitalsValidation';

interface VitalsFormProps {
  rules: VitalsRules;
  values: VitalsData;
  chiefComplaint: string;
  fieldErrors: FieldValidations;
  onVitalChange: (name: VitalName, value: string) => void;
  onChiefComplaintChange: (value: string) => void;
  /** Exposed so parent can scroll to first invalid field */
  formRef?: React.RefObject<HTMLFormElement | null>;
  /** Server-returned error message */
  formError?: string | null;
}

function fieldClassName(name: VitalName, fieldErrors: FieldValidations): string {
  const result = fieldErrors[name];
  if (!result || result.level === 'ok' || result.level === null) return 'form-control';
  if (result.level === 'error') return 'form-control is-invalid';
  if (result.level === 'warning') return 'form-control nc-vitals-warning';
  return 'form-control';
}

export function VitalsForm({
  rules,
  values,
  chiefComplaint,
  fieldErrors,
  onVitalChange,
  onChiefComplaintChange,
  formRef,
  formError,
}: VitalsFormProps) {
  const internalRef = useRef<HTMLFormElement>(null);
  const ref = formRef ?? internalRef;

  return (
    <form
      ref={ref}
      id="nc-triage-vitals-form"
      className="nc-triage-vitals-form"
      noValidate
      onSubmit={(e) => e.preventDefault()}
    >
      <h5 className="mb-3">Vitals</h5>
      <p className="nc-vitals-required-note small text-muted mb-3">
        <span className="text-danger">*</span> Required.{' '}
        <span className="text-warning font-weight-bold">Amber</span> border = outside normal clinical range but still saveable.{' '}
        <span className="text-danger font-weight-bold">Red</span> = fix before saving.
      </p>

      {/* Field rows */}
      {VITAL_ORDER.map((row, rowIdx) => (
        <div className="form-row" key={rowIdx}>
          {row.map((name) => {
            const def = rules.fields[name];
            if (!def) return null;
            const result = fieldErrors[name];
            const showFeedback = !!result && result.level !== 'ok';
            return (
              <div className="form-group col-md-3" key={name} data-vitals-field={name}>
                <label
                  className="nc-vitals-field-label"
                  htmlFor={`nc-vitals-${name}`}
                >
                  {def.label}
                  {def.unit && ` (${def.unit})`}
                  {def.required && <span className="text-danger ml-1">*</span>}
                  <span className="nc-vitals-range-hint d-block text-muted" style={{ fontSize: '0.72rem' }}>
                    Acceptable: {def.min}–{def.max}
                  </span>
                </label>
                <input
                  type="number"
                  id={`nc-vitals-${name}`}
                  name={name}
                  className={fieldClassName(name, fieldErrors)}
                  value={values[name] ?? ''}
                  min={def.min}
                  max={def.max}
                  step={def.step ?? 1}
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(e) => onVitalChange(name, e.target.value)}
                />
                {showFeedback && result && (result.level === 'error' || result.level === 'warning') && (
                  <div
                    className={
                      result.level === 'error'
                        ? 'nc-vitals-feedback invalid-feedback d-block'
                        : 'nc-vitals-feedback nc-vitals-feedback--warning d-block'
                    }
                    aria-live="polite"
                  >
                    {result.message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Chief complaint — fully controlled so value always reflects parent state */}
      <div className="form-group">
        <label htmlFor="nc-vitals-chief-complaint">Chief complaint (optional)</label>
        <textarea
          id="nc-vitals-chief-complaint"
          className="form-control"
          name="chief_complaint"
          rows={2}
          maxLength={500}
          value={chiefComplaint}
          onChange={(e) => onChiefComplaintChange(e.target.value)}
        />
      </div>

      {/* Form-level error */}
      {formError && (
        <div className="alert alert-danger" role="alert">
          {formError}
        </div>
      )}
    </form>
  );
}
