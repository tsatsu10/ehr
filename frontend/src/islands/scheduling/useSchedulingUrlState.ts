import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SchedulingFilters, SchedulingLens } from './schedulingTypes';
import { ALL_PROVIDERS_ID, LENS_LABELS } from './schedulingTypes';

const LENS_PARAM = 'lens';
const DATE_PARAM = 'date';
const FACILITY_PARAM = 'facility_id';
const PROVIDER_PARAM = 'provider_id';

function readLensFromUrl(): SchedulingLens | null {
  const raw = new URLSearchParams(window.location.search).get(LENS_PARAM);
  if (raw === 'calendar' || raw === 'flow' || raw === 'recalls') {
    return raw;
  }
  return null;
}

function readFiltersFromUrl(defaults: SchedulingFilters): SchedulingFilters {
  const params = new URLSearchParams(window.location.search);
  const facilityRaw = params.get(FACILITY_PARAM);
  const providerRaw = params.get(PROVIDER_PARAM);
  const dateRaw = params.get(DATE_PARAM);

  return {
    facilityId: facilityRaw != null && facilityRaw !== ''
      ? Number.parseInt(facilityRaw, 10)
      : defaults.facilityId,
    providerId: providerRaw != null && providerRaw !== ''
      ? Number.parseInt(providerRaw, 10)
      : defaults.providerId,
    date: dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : defaults.date,
  };
}

const PID_PARAM = 'pid';

function readPidFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get(PID_PARAM);
  if (raw == null || raw === '') {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function writeUrlState(lens: SchedulingLens, filters: SchedulingFilters, filterPid: number | null): void {
  const params = new URLSearchParams(window.location.search);
  params.set(LENS_PARAM, lens);
  params.set(DATE_PARAM, filters.date);
  params.set(FACILITY_PARAM, String(filters.facilityId));
  if (filters.providerId > ALL_PROVIDERS_ID) {
    params.set(PROVIDER_PARAM, String(filters.providerId));
  } else {
    params.delete(PROVIDER_PARAM);
  }
  if (filterPid != null && filterPid > 0) {
    params.set(PID_PARAM, String(filterPid));
  } else {
    params.delete(PID_PARAM);
  }
  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState(null, '', next);
}

interface UseSchedulingUrlStateOptions {
  initialLens: SchedulingLens;
  initialFilters: SchedulingFilters;
}

export function useSchedulingUrlState({
  initialLens,
  initialFilters,
}: UseSchedulingUrlStateOptions) {
  const [lens, setLensState] = useState<SchedulingLens>(() => readLensFromUrl() ?? initialLens);
  const [filters, setFiltersState] = useState<SchedulingFilters>(() => {
    const fromUrl = readFiltersFromUrl(initialFilters);
    return {
      facilityId: Number.isFinite(fromUrl.facilityId) ? fromUrl.facilityId : initialFilters.facilityId,
      providerId: Number.isFinite(fromUrl.providerId) ? fromUrl.providerId : initialFilters.providerId,
      date: fromUrl.date,
    };
  });
  const [filterPid] = useState<number | null>(() => readPidFromUrl());

  useEffect(() => {
    writeUrlState(lens, filters, filterPid);
  }, [filters, filterPid, lens]);

  const setLens = useCallback((next: SchedulingLens) => {
    setLensState(next);
  }, []);

  const setFilters = useCallback((patch: Partial<SchedulingFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const summaryLine = useMemo(() => {
    const parts = [LENS_LABELS[lens], filters.date];
    if (filters.providerId > ALL_PROVIDERS_ID) {
      parts.push(`Provider #${filters.providerId}`);
    }
    return parts.join(' · ');
  }, [filters.date, filters.providerId, lens]);

  return { lens, setLens, filters, setFilters, summaryLine, filterPid };
}
