import type { RegistryFilters, RegistryPreset } from './registryTypes';

interface RegistryFilterPanelProps {
  filters: RegistryFilters;
  presets: RegistryPreset[];
  selectedPresetId: string;
  visitStates: string[];
  visitTypes: { id: number; label: string }[];
  confirmationSources: { value: string; label: string }[];
  conditionMap: { key: string; label: string }[];
  onFiltersChange: (patch: Partial<RegistryFilters>) => void;
  onPresetChange: (presetId: string) => void;
  onApply: () => void;
  onClear: () => void;
}

function setField(
  onFiltersChange: RegistryFilterPanelProps['onFiltersChange'],
  key: keyof RegistryFilters,
  value: string
): void {
  onFiltersChange({ [key]: value });
}

export function RegistryFilterPanel({
  filters,
  presets,
  selectedPresetId,
  visitStates,
  visitTypes,
  confirmationSources,
  conditionMap,
  onFiltersChange,
  onPresetChange,
  onApply,
  onClear,
}: RegistryFilterPanelProps) {
  const builtins = presets.filter((p) => !p.saved_id);
  const saved = presets.filter((p) => p.saved_id);

  return (
    <aside className="col-lg-4 mb-3">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Filters</strong>
          <select
            className="form-control form-control-sm w-auto"
            aria-label="Presets"
            value={selectedPresetId}
            onChange={(e) => onPresetChange(e.target.value)}
          >
            <option value="">Presets…</option>
            {builtins.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            {saved.length > 0 && (
              <optgroup label="Saved filters">
                {saved.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label htmlFor="nc-registry-record-status">Record status</label>
            <select
              id="nc-registry-record-status"
              className="form-control form-control-sm"
              value={filters.record_status}
              onChange={(e) => setField(onFiltersChange, 'record_status', e.target.value)}
            >
              <option value="active_only">Active patients only</option>
              <option value="include_inactive">Include inactive</option>
              <option value="deceased_only">Deceased only</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group col-6">
              <label htmlFor="nc-registry-age-min">Age from</label>
              <input
                id="nc-registry-age-min"
                type="number"
                className="form-control form-control-sm"
                min={0}
                value={filters.age_today_min}
                onChange={(e) => setField(onFiltersChange, 'age_today_min', e.target.value)}
              />
            </div>
            <div className="form-group col-6">
              <label htmlFor="nc-registry-age-max">Age to</label>
              <input
                id="nc-registry-age-max"
                type="number"
                className="form-control form-control-sm"
                min={0}
                value={filters.age_today_max}
                onChange={(e) => setField(onFiltersChange, 'age_today_max', e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="nc-registry-sex">Sex</label>
            <select
              id="nc-registry-sex"
              className="form-control form-control-sm"
              value={filters.sex}
              onChange={(e) => setField(onFiltersChange, 'sex', e.target.value)}
            >
              <option value="any">Any</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="nc-registry-name">Name contains</label>
            <input
              id="nc-registry-name"
              type="search"
              className="form-control form-control-sm"
              value={filters.name_contains}
              onChange={(e) => setField(onFiltersChange, 'name_contains', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="nc-registry-mrn">MRN</label>
            <input
              id="nc-registry-mrn"
              type="search"
              className="form-control form-control-sm"
              value={filters.mrn}
              onChange={(e) => setField(onFiltersChange, 'mrn', e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group col-6">
              <label htmlFor="nc-registry-national-id">National ID</label>
              <input
                id="nc-registry-national-id"
                type="search"
                className="form-control form-control-sm"
                value={filters.national_id}
                onChange={(e) => setField(onFiltersChange, 'national_id', e.target.value)}
              />
            </div>
            <div className="form-group col-6">
              <label htmlFor="nc-registry-nhis">NHIS number</label>
              <input
                id="nc-registry-nhis"
                type="search"
                className="form-control form-control-sm"
                value={filters.nhis_number}
                onChange={(e) => setField(onFiltersChange, 'nhis_number', e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="nc-registry-phone">Phone</label>
            <input
              id="nc-registry-phone"
              type="search"
              className="form-control form-control-sm"
              value={filters.phone}
              onChange={(e) => setField(onFiltersChange, 'phone', e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group col-6">
              <label htmlFor="nc-registry-completion-min">Completion % min</label>
              <input
                id="nc-registry-completion-min"
                type="number"
                className="form-control form-control-sm"
                min={0}
                max={100}
                value={filters.completion_min}
                onChange={(e) => setField(onFiltersChange, 'completion_min', e.target.value)}
              />
            </div>
            <div className="form-group col-6">
              <label htmlFor="nc-registry-completion-max">Completion % max</label>
              <input
                id="nc-registry-completion-max"
                type="number"
                className="form-control form-control-sm"
                min={0}
                max={100}
                value={filters.completion_max}
                onChange={(e) => setField(onFiltersChange, 'completion_max', e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="nc-registry-active-visit">Active visit today</label>
            <select
              id="nc-registry-active-visit"
              className="form-control form-control-sm"
              value={filters.active_visit_today}
              onChange={(e) => {
                onFiltersChange({
                  active_visit_today: e.target.value,
                  my_provider_today: false,
                });
              }}
            >
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <details className="oe-nc-registry-visit-filters mb-2">
            <summary className="small font-weight-bold">Visit filters</summary>
            <div className="mt-2">
              <div className="form-group">
                <label htmlFor="nc-registry-visit-states">Visit state</label>
                <select
                  id="nc-registry-visit-states"
                  className="form-control form-control-sm"
                  multiple
                  size={5}
                  aria-label="Visit state"
                  value={filters.visit_states}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    onFiltersChange({ visit_states: selected });
                  }}
                >
                  {visitStates.map((state) => (
                    <option key={state} value={state}>
                      {state.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <small className="text-muted">Ctrl+click to select multiple</small>
              </div>
              <div className="form-group">
                <label htmlFor="nc-registry-visit-type">Visit type</label>
                <select
                  id="nc-registry-visit-type"
                  className="form-control form-control-sm"
                  value={filters.visit_type_id}
                  onChange={(e) => setField(onFiltersChange, 'visit_type_id', e.target.value)}
                >
                  <option value="">Any</option>
                  {visitTypes.map((type) => (
                    <option key={type.id} value={String(type.id)}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-visit-from">Visit from</label>
                  <input
                    id="nc-registry-visit-from"
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.visit_date_from}
                    onChange={(e) => setField(onFiltersChange, 'visit_date_from', e.target.value)}
                  />
                </div>
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-visit-to">Visit to</label>
                  <input
                    id="nc-registry-visit-to"
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.visit_date_to}
                    onChange={(e) => setField(onFiltersChange, 'visit_date_to', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="nc-registry-payment">Payment status</label>
                <select
                  id="nc-registry-payment"
                  className="form-control form-control-sm"
                  value={filters.payment_status}
                  onChange={(e) => setField(onFiltersChange, 'payment_status', e.target.value)}
                >
                  <option value="any">Any</option>
                  <option value="paid">Paid</option>
                  <option value="outstanding">Outstanding</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-last-visit-from">Last visit from</label>
                  <input
                    id="nc-registry-last-visit-from"
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.last_visit_from}
                    onChange={(e) => setField(onFiltersChange, 'last_visit_from', e.target.value)}
                  />
                </div>
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-last-visit-to">Last visit to</label>
                  <input
                    id="nc-registry-last-visit-to"
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.last_visit_to}
                    onChange={(e) => setField(onFiltersChange, 'last_visit_to', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </details>

          <details className="oe-nc-registry-clinical-filters mb-2">
            <summary className="small font-weight-bold">Clinical filters</summary>
            <div className="mt-2">
              <div className="form-group">
                <label htmlFor="nc-registry-condition-key">Condition</label>
                <select
                  id="nc-registry-condition-key"
                  className="form-control form-control-sm"
                  value={filters.condition_key}
                  onChange={(e) => setField(onFiltersChange, 'condition_key', e.target.value)}
                >
                  <option value="">Any / manual below</option>
                  {conditionMap.map((row) => (
                    <option key={row.key} value={row.key}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="nc-registry-problem-title">Problem title contains</label>
                <input
                  id="nc-registry-problem-title"
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="e.g. malaria"
                  value={filters.problem_title_contains}
                  onChange={(e) => setField(onFiltersChange, 'problem_title_contains', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="nc-registry-icd-prefix">ICD prefix</label>
                <input
                  id="nc-registry-icd-prefix"
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="e.g. B50"
                  value={filters.icd_prefix}
                  onChange={(e) => setField(onFiltersChange, 'icd_prefix', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="nc-registry-lab-test">Lab test contains</label>
                <input
                  id="nc-registry-lab-test"
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="e.g. malaria RDT"
                  value={filters.lab_test_contains}
                  onChange={(e) => setField(onFiltersChange, 'lab_test_contains', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="nc-registry-confirmation-source">Confirmation source</label>
                <select
                  id="nc-registry-confirmation-source"
                  className="form-control form-control-sm"
                  value={filters.confirmation_source}
                  onChange={(e) => setField(onFiltersChange, 'confirmation_source', e.target.value)}
                >
                  {confirmationSources.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-age-dx-min">Age at diagnosis from</label>
                  <input
                    id="nc-registry-age-dx-min"
                    type="number"
                    className="form-control form-control-sm"
                    min={0}
                    max={120}
                    value={filters.age_at_diagnosis_min}
                    onChange={(e) => setField(onFiltersChange, 'age_at_diagnosis_min', e.target.value)}
                  />
                </div>
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-age-dx-max">Age at diagnosis to</label>
                  <input
                    id="nc-registry-age-dx-max"
                    type="number"
                    className="form-control form-control-sm"
                    min={0}
                    max={120}
                    value={filters.age_at_diagnosis_max}
                    onChange={(e) => setField(onFiltersChange, 'age_at_diagnosis_max', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-diagnosis-from">Diagnosis from</label>
                  <input
                    id="nc-registry-diagnosis-from"
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.diagnosis_date_from}
                    onChange={(e) => setField(onFiltersChange, 'diagnosis_date_from', e.target.value)}
                  />
                </div>
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-diagnosis-to">Diagnosis to</label>
                  <input
                    id="nc-registry-diagnosis-to"
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.diagnosis_date_to}
                    onChange={(e) => setField(onFiltersChange, 'diagnosis_date_to', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </details>

          <details className="oe-nc-registry-scheduling-filters mb-2">
            <summary className="small font-weight-bold">Scheduling & recalls</summary>
            <div className="mt-2">
              <div className="form-group">
                <label htmlFor="nc-registry-appointment-today">Appointment today</label>
                <select
                  id="nc-registry-appointment-today"
                  className="form-control form-control-sm"
                  value={filters.appointment_today}
                  onChange={(e) => setField(onFiltersChange, 'appointment_today', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-appointment-from">Appointment from</label>
                  <input
                    id="nc-registry-appointment-from"
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.appointment_date_from}
                    onChange={(e) => setField(onFiltersChange, 'appointment_date_from', e.target.value)}
                  />
                </div>
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-appointment-to">Appointment to</label>
                  <input
                    id="nc-registry-appointment-to"
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.appointment_date_to}
                    onChange={(e) => setField(onFiltersChange, 'appointment_date_to', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="nc-registry-recall-due">Recall due</label>
                <select
                  id="nc-registry-recall-due"
                  className="form-control form-control-sm"
                  value={filters.recall_due}
                  onChange={(e) => setField(onFiltersChange, 'recall_due', e.target.value)}
                >
                  <option value="any">Any</option>
                  <option value="overdue">Overdue</option>
                  <option value="due_soon">Due soon (14 days)</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-recall-from">Recall from</label>
                  <input
                    id="nc-registry-recall-from"
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.recall_date_from}
                    onChange={(e) => setField(onFiltersChange, 'recall_date_from', e.target.value)}
                  />
                </div>
                <div className="form-group col-6">
                  <label htmlFor="nc-registry-recall-to">Recall to</label>
                  <input
                    id="nc-registry-recall-to"
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.recall_date_to}
                    onChange={(e) => setField(onFiltersChange, 'recall_date_to', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </details>

          <div className="d-flex">
            <button type="button" className="btn btn-primary btn-sm mr-2" onClick={onApply}>
              Apply
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClear}>
              Clear
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
