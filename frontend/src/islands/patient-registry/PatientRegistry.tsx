import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { ConfirmModal } from '@components/ConfirmModal';
import { usePageHeadingRefresh } from '@core/usePageHeadingToolbar';
import { emptyRegistryFilters } from './registryDefaults';
import {
  applyPresetToFilters,
  filtersToApiPayload,
  formatSearchSummary,
} from './registryFilterUtils';
import { exportRegistryCsv } from './registryExport';
import { RegistryFilterPanel } from './RegistryFilterPanel';
import { RegistryResultsTable } from './RegistryResultsTable';
import type {
  PatientRegistryProps,
  RegistryFilters,
  RegistryPreset,
  RegistryPresetsData,
  RegistryRow,
  RegistrySearchStatus,
} from './registryTypes';

const PAGE_SIZE = 25;

function usePageHeadingButton(
  buttonId: string,
  onClick: () => void,
  visible = true
): void {
  useEffect(() => {
    const button = document.getElementById(buttonId);
    if (!button) return undefined;

    if (visible) {
      button.classList.remove('d-none');
    } else {
      button.classList.add('d-none');
    }

    const handler = () => onClick();
    button.addEventListener('click', handler);
    return () => button.removeEventListener('click', handler);
  }, [buttonId, onClick, visible]);
}

export function PatientRegistry({
  ajaxUrl,
  csrfToken,
  chartUrlBase,
}: PatientRegistryProps) {
  const [filters, setFilters] = useState<RegistryFilters>(emptyRegistryFilters);
  const [presets, setPresets] = useState<RegistryPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [selectedSavedId, setSelectedSavedId] = useState(0);
  const [canShareFilter, setCanShareFilter] = useState(false);
  const [visitStates, setVisitStates] = useState<string[]>([]);
  const [visitTypes, setVisitTypes] = useState<{ id: number; label: string }[]>([]);
  const [confirmationSources, setConfirmationSources] = useState<
    { value: string; label: string }[]
  >([]);
  const [conditionMap, setConditionMap] = useState<{ key: string; label: string }[]>([]);

  const [rows, setRows] = useState<RegistryRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<RegistrySearchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState('Apply filters to search the registry.');
  const [pendingConfirm, setPendingConfirm] = useState<'export' | 'delete' | null>(null);
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [shareFilter, setShareFilter] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchOptions = useMemo(
    () => ({ ajaxUrl, csrfToken }),
    [ajaxUrl, csrfToken]
  );

  const loadPresets = useCallback(async () => {
    const data = await oeFetch<RegistryPresetsData>('cohort.presets', fetchOptions);
    const allPresets = [...(data.builtins ?? []), ...(data.saved ?? [])];
    setPresets(allPresets);
    setCanShareFilter(!!data.can_share_filter);
    setVisitStates(data.visit_states ?? []);
    setVisitTypes(data.visit_types ?? []);
    setConfirmationSources(data.confirmation_sources ?? []);
    setConditionMap(data.condition_map ?? []);
  }, [fetchOptions]);

  useEffect(() => {
    void loadPresets().catch(() => {
      /* presets are optional on first paint */
    });
  }, [loadPresets]);

  useEffect(() => {
    if (confirmationSources.length === 0) return;
    setFilters((prev) =>
      prev.confirmation_source === ''
        ? { ...prev, confirmation_source: confirmationSources[0].value }
        : prev
    );
  }, [confirmationSources]);

  const runSearch = useCallback(
    async (pageNum: number, currentFilters: RegistryFilters) => {
      setStatus('loading');
      setErrorMessage(null);
      try {
        const data = await oeFetch<{
          rows: RegistryRow[];
          total: number;
          page: number;
          page_size: number;
          meta: { filter_summary?: string; excluded_missing_dob?: number; query_ms?: number };
        }>('cohort.search', {
          ...fetchOptions,
          json: {
            page: pageNum,
            page_size: PAGE_SIZE,
            sort: 'name_asc',
            filters: filtersToApiPayload(currentFilters),
          },
        });
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
        setPage(data.page ?? pageNum);
        setSummaryText(formatSearchSummary(data.total ?? 0, data.meta ?? {}));
        setStatus('success');
      } catch (err) {
        setRows([]);
        setErrorMessage(err instanceof Error ? err.message : 'Search failed');
        setStatus('error');
      }
    },
    [fetchOptions]
  );

  const handleApply = useCallback(() => {
    setPage(1);
    void runSearch(1, filters);
  }, [filters, runSearch]);

  const handleRefresh = useCallback(() => {
    if (status === 'idle') return;
    void runSearch(page, filters);
  }, [status, page, filters, runSearch]);

  const handleClear = useCallback(() => {
    setFilters({
      ...emptyRegistryFilters(),
      confirmation_source: confirmationSources[0]?.value ?? '',
    });
    setSelectedPresetId('');
    setSelectedSavedId(0);
    setRows([]);
    setTotal(0);
    setPage(1);
    setStatus('idle');
    setErrorMessage(null);
    setSummaryText('Apply filters to search the registry.');
  }, [confirmationSources]);

  const handlePresetChange = useCallback(
    (presetId: string) => {
      setSelectedPresetId(presetId);
      if (!presetId) {
        setSelectedSavedId(0);
        return;
      }
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;

      setSelectedSavedId(preset.saved_id ?? 0);
      const nextFilters = applyPresetToFilters(preset.filters ?? {});
      setFilters(nextFilters);
      setPage(1);
      void runSearch(1, nextFilters);
    },
    [presets, runSearch]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      void runSearch(nextPage, filters);
    },
    [filters, runSearch]
  );

  const handleExport = useCallback(() => {
    setPendingConfirm('export');
  }, []);

  const runExport = useCallback(async () => {
    try {
      await exportRegistryCsv(ajaxUrl, csrfToken, filtersToApiPayload(filters));
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [ajaxUrl, csrfToken, filters]);

  const handleSaveFilter = useCallback(() => {
    setFilterName('');
    setShareFilter(false);
    setSaveFilterOpen(true);
  }, []);

  const submitSaveFilter = useCallback(async () => {
    const name = filterName.trim();
    if (!name) return;

    try {
      await oeFetch<{ success?: boolean }>('cohort.saved_filter', {
        ...fetchOptions,
        json: {
          operation: 'save',
          name,
          is_shared: shareFilter ? 1 : 0,
          filters: filtersToApiPayload(filters),
        },
      });
      setSaveFilterOpen(false);
      setActionError(null);
      await loadPresets();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save filter');
    }
  }, [fetchOptions, filterName, filters, loadPresets, shareFilter]);

  const handleDeleteFilter = useCallback(() => {
    if (selectedSavedId <= 0) return;
    setPendingConfirm('delete');
  }, [selectedSavedId]);

  const runDeleteFilter = useCallback(async () => {
    try {
      await oeFetch<{ success?: boolean }>('cohort.saved_filter', {
        ...fetchOptions,
        json: {
          operation: 'delete',
          id: selectedSavedId,
        },
      });
      setSelectedSavedId(0);
      setSelectedPresetId('');
      setActionError(null);
      await loadPresets();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete filter');
    }
  }, [fetchOptions, loadPresets, selectedSavedId]);

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);
  const showDeleteSaved =
    selectedSavedId > 0 && selectedPreset?.can_delete === true;

  usePageHeadingRefresh('nc-registry-refresh', handleRefresh);
  usePageHeadingButton('nc-registry-export', handleExport);
  usePageHeadingButton('nc-registry-save-filter', handleSaveFilter);
  usePageHeadingButton('nc-registry-delete-filter', handleDeleteFilter, showDeleteSaved);

  return (
    <div className="oe-nc-registry row">
      {actionError && (
        <div className="col-12">
          <div className="alert alert-danger py-2" role="alert">{actionError}</div>
        </div>
      )}
      <RegistryFilterPanel
        filters={filters}
        presets={presets}
        selectedPresetId={selectedPresetId}
        visitStates={visitStates}
        visitTypes={visitTypes}
        confirmationSources={confirmationSources}
        conditionMap={conditionMap}
        onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onPresetChange={handlePresetChange}
        onApply={handleApply}
        onClear={handleClear}
      />
      <RegistryResultsTable
        rows={rows}
        chartUrlBase={chartUrlBase}
        status={status}
        errorMessage={errorMessage}
        summaryText={summaryText}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={handlePageChange}
      />

      <ConfirmModal
        open={pendingConfirm === 'export'}
        onClose={() => setPendingConfirm(null)}
        title="Export registry?"
        modalId="nc-registry-export-modal"
        confirmLabel="Export CSV"
        confirmVariant="primary"
        onConfirm={() => {
          setPendingConfirm(null);
          void runExport();
        }}
      >
        <p className="mb-0">Export current filters to CSV (max 5,000 rows)?</p>
      </ConfirmModal>

      <ConfirmModal
        open={pendingConfirm === 'delete'}
        onClose={() => setPendingConfirm(null)}
        title="Delete saved filter?"
        modalId="nc-registry-delete-modal"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          setPendingConfirm(null);
          void runDeleteFilter();
        }}
      >
        <p className="mb-0">Delete this saved filter? This cannot be undone.</p>
      </ConfirmModal>

      <ConfirmModal
        open={saveFilterOpen}
        onClose={() => setSaveFilterOpen(false)}
        title="Save filter"
        modalId="nc-registry-save-filter-modal"
        confirmLabel="Save"
        confirmDisabled={filterName.trim() === ''}
        onConfirm={() => { void submitSaveFilter(); }}
      >
        <div className="form-group mb-2">
          <label htmlFor="nc-registry-filter-name">Filter name</label>
          <input
            id="nc-registry-filter-name"
            className="form-control"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            autoFocus
          />
        </div>
        {canShareFilter && (
          <div className="form-check">
            <input
              id="nc-registry-filter-share"
              type="checkbox"
              className="form-check-input"
              checked={shareFilter}
              onChange={(e) => setShareFilter(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="nc-registry-filter-share">
              Share with the whole clinic
            </label>
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}
