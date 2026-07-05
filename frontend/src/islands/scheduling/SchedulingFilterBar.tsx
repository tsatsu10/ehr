import { useState } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { useDeskViewport } from '@core/useDeskViewport';
import type { SchedulingFilters, SchedulingLabels, SchedulingOption } from './schedulingTypes';
import { ALL_PROVIDERS_ID } from './schedulingTypes';
import { resolveSchedulingLabels } from './schedulingLabels';

interface SchedulingFilterBarProps {
  filters: SchedulingFilters;
  facilities: SchedulingOption[];
  providers: SchedulingOption[];
  labels?: Partial<SchedulingLabels>;
  onChange: (patch: Partial<SchedulingFilters>) => void;
}

export function SchedulingFilterBar({
  filters,
  facilities,
  providers,
  labels: labelOverrides,
  onChange,
}: SchedulingFilterBarProps) {
  const viewport = useDeskViewport();
  const labels = resolveSchedulingLabels(labelOverrides);
  const [expanded, setExpanded] = useState(viewport !== 'mobile');
  const collapsible = viewport === 'mobile';

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
      <div className={`grid grid-cols-12 gap-3${collapsible && !expanded ? ' hidden' : ''}`}>
        <div className="col-span-12 md:col-span-4 mb-2 md:mb-0">
          <label className="text-sm text-[var(--oe-nc-text-muted)] mb-1" htmlFor="nc-scheduling-facility">Facility</label>
          <NativeSelect
            id="nc-scheduling-facility"
            className="h-8"
            value={filters.facilityId}
            onChange={(e) => onChange({ facilityId: Number.parseInt(e.target.value, 10) })}
          >
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>{facility.label}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="col-span-12 md:col-span-4 mb-2 md:mb-0">
          <label className="text-sm text-[var(--oe-nc-text-muted)] mb-1" htmlFor="nc-scheduling-provider">Provider</label>
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
        <div className="col-span-12 md:col-span-4">
          <label className="text-sm text-[var(--oe-nc-text-muted)] mb-1" htmlFor="nc-scheduling-date">Date</label>
          <Input
            id="nc-scheduling-date"
            type="date"
            className="h-8"
            value={filters.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
