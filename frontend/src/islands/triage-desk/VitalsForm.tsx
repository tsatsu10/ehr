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
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Textarea } from '@components/ui/textarea';
import { cn } from '@/lib/utils';

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

function vitalInputClassName(name: VitalName, fieldErrors: FieldValidations): string {
  const result = fieldErrors[name];
  if (!result || result.level === 'ok' || result.level === null) return '';
  if (result.level === 'error') {
    return 'border-[var(--oe-nc-danger,#dc2626)] focus-visible:ring-[var(--oe-nc-danger,#dc2626)]';
  }
  if (result.level === 'warning') return 'nc-vitals-warning';
  return '';
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
      <p className="nc-vitals-required-note text-sm text-[var(--oe-nc-text-muted)] mb-3">
        <span className="text-[var(--oe-nc-danger,#dc2626)]">*</span> Required.{' '}
        <span className="text-[var(--color-oe-warning,#ea580c)] font-bold">Amber</span> border = outside normal clinical range but still saveable.{' '}
        <span className="text-[var(--oe-nc-danger,#dc2626)] font-bold">Red</span> = fix before saving.
      </p>

      {VITAL_ORDER.map((row, rowIdx) => (
        <div className="grid grid-cols-12 gap-3" key={rowIdx}>
          {row.map((name) => {
            const def = rules.fields[name];
            if (!def) return null;
            const result = fieldErrors[name];
            const showFeedback = !!result && result.level !== 'ok';
            return (
              <div className="nc-form-group col-span-12 md:col-span-3" key={name} data-vitals-field={name}>
                <Label
                  className="nc-vitals-field-label font-normal"
                  htmlFor={`nc-vitals-${name}`}
                >
                  {def.label}
                  {def.unit && ` (${def.unit})`}
                  {def.required && <span className="text-[var(--oe-nc-danger,#dc2626)] ml-1">*</span>}
                  <span className="nc-vitals-range-hint block text-[var(--oe-nc-text-muted)]">
                    Acceptable: {def.min}–{def.max}
                  </span>
                </Label>
                <Input
                  type="number"
                  id={`nc-vitals-${name}`}
                  name={name}
                  className={cn('h-9', vitalInputClassName(name, fieldErrors))}
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
                        ? 'nc-vitals-feedback block text-sm text-[var(--oe-nc-danger,#dc2626)]'
                        : 'nc-vitals-feedback nc-vitals-feedback--warning block'
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

      <div className="space-y-1.5 mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="nc-vitals-chief-complaint">Reason for visit</Label>
          <span
            className="text-xs tabular-nums text-(--oe-nc-text-muted)"
            id="nc-vitals-chief-complaint-count"
            aria-live="polite"
          >
            {chiefComplaint.length}/500
          </span>
        </div>
        <Textarea
          id="nc-vitals-chief-complaint"
          name="chief_complaint"
          rows={2}
          maxLength={500}
          placeholder="Why the patient came today…"
          value={chiefComplaint}
          onChange={(e) => onChiefComplaintChange(e.target.value)}
        />
        <p className="text-xs text-(--oe-nc-text-muted) m-0">
          Optional — overwrites reception text when saved; shown on the patient banner.
        </p>
      </div>

      {formError && (
        <div className={deskCalloutClass('error', 'mt-3 text-sm')} role="alert">
          {formError}
        </div>
      )}
    </form>
  );
}
