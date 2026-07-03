import { useState } from 'react';
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
    <div className="oe-nc-scheduling__filters mb-3" aria-label="Scheduling filters">
      {collapsible && (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm mb-2"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? labels.hideFilters : labels.showFilters}
        </button>
      )}
      <div className={`row${collapsible && !expanded ? ' d-none' : ''}`}>
        <div className="col-md-4 mb-2 mb-md-0">
          <label className="small text-muted mb-1" htmlFor="nc-scheduling-facility">Facility</label>
          <select
            id="nc-scheduling-facility"
            className="form-control form-control-sm"
            value={filters.facilityId}
            onChange={(e) => onChange({ facilityId: Number.parseInt(e.target.value, 10) })}
          >
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>{facility.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4 mb-2 mb-md-0">
          <label className="small text-muted mb-1" htmlFor="nc-scheduling-provider">Provider</label>
          <select
            id="nc-scheduling-provider"
            className="form-control form-control-sm"
            value={filters.providerId}
            onChange={(e) => onChange({ providerId: Number.parseInt(e.target.value, 10) })}
          >
            <option value={ALL_PROVIDERS_ID}>{labels.allProviders}</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="small text-muted mb-1" htmlFor="nc-scheduling-date">Date</label>
          <input
            id="nc-scheduling-date"
            type="date"
            className="form-control form-control-sm"
            value={filters.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
