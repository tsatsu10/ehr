import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { useDeskViewport } from '@core/useDeskViewport';
import type { SchedulingFilters, SchedulingLabels, SchedulingOption } from './schedulingTypes';
import { ALL_PROVIDERS_ID } from './schedulingTypes';
import { localTodayIso, shiftDate, type DateStepUnit } from './schedulingCalendarUtils';
import { resolveSchedulingLabels } from './schedulingLabels';

interface SchedulingFilterBarProps {
  filters: SchedulingFilters;
  providers: SchedulingOption[];
  /** Unit the ‹ Today › stepper moves by — follows the active calendar view. */
  stepUnit?: DateStepUnit;
  labels?: Partial<SchedulingLabels>;
  onChange: (patch: Partial<SchedulingFilters>) => void;
}

export function SchedulingFilterBar({
  filters,
  providers,
  stepUnit = 'day',
  labels: labelOverrides,
  onChange,
}: SchedulingFilterBarProps) {
  const viewport = useDeskViewport();
  const labels = resolveSchedulingLabels(labelOverrides);
  const [expanded, setExpanded] = useState(viewport !== 'mobile');
  const collapsible = viewport === 'mobile';
  const stepLabels: Record<DateStepUnit, { prev: string; next: string }> = {
    day: { prev: labels.previousDay, next: labels.nextDay },
    week: { prev: labels.previousWeek, next: labels.nextWeek },
    month: { prev: labels.previousMonth, next: labels.nextMonth },
  };
  // Group label follows the active view so a screen reader hears the real unit
  // (Week/Month), not a fixed "days".
  const stepGroupLabels: Record<DateStepUnit, string> = {
    day: 'Change day',
    week: 'Change week',
    month: 'Change month',
  };
  const isToday = filters.date === localTodayIso();

  return (
    <div className="nc-scheduling-filters mb-3" aria-label="Scheduling filters">
      {collapsible && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-2"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? labels.hideFilters : labels.showFilters}
        </Button>
      )}
      <div className={`flex flex-wrap items-end gap-3${collapsible && !expanded ? ' hidden' : ''}`}>
        <div className="w-full md:w-auto md:min-w-[13rem]">
          <label className="mb-1 block text-xs font-semibold text-[var(--oe-nc-text-muted)]" htmlFor="nc-scheduling-provider">Provider</label>
          <NativeSelect
            id="nc-scheduling-provider"
            className="h-8"
            value={filters.providerId}
            onChange={(e) => onChange({ providerId: Number.parseInt(e.target.value, 10) })}
          >
            <option value={ALL_PROVIDERS_ID}>{labels.allProviders}</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-full md:w-auto md:min-w-[11rem]">
          <label className="mb-1 block text-xs font-semibold text-[var(--oe-nc-text-muted)]" htmlFor="nc-scheduling-date">Date</label>
          <Input
            id="nc-scheduling-date"
            type="date"
            className="h-8"
            value={filters.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>
        <div className="flex items-end gap-1" role="group" aria-label={stepGroupLabels[stepUnit]}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-9 px-0"
            aria-label={stepLabels[stepUnit].prev}
            title={stepLabels[stepUnit].prev}
            onClick={() => onChange({ date: shiftDate(filters.date, stepUnit, -1) })}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={isToday}
            onClick={() => onChange({ date: localTodayIso() })}
          >
            {labels.today}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-9 px-0"
            aria-label={stepLabels[stepUnit].next}
            title={stepLabels[stepUnit].next}
            onClick={() => onChange({ date: shiftDate(filters.date, stepUnit, 1) })}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
