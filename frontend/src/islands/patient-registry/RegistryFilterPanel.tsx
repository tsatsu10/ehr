import type { RegistryFilters, RegistryPreset } from './registryTypes';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';

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
    <aside className="col-span-12 lg:col-span-4 mb-3">
      <Card>
        <CardHeader className="px-5 py-4">
          <strong>Filters</strong>
          <NativeSelect
            className="h-8 w-auto"
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
          </NativeSelect>
        </CardHeader>
        <CardContent>
          <div className="nc-form-group">
            <label htmlFor="nc-registry-record-status">Record status</label>
            <NativeSelect
              id="nc-registry-record-status"
              className="h-8"
              value={filters.record_status}
              onChange={(e) => setField(onFiltersChange, 'record_status', e.target.value)}
            >
              <option value="active_only">Active patients only</option>
              <option value="include_inactive">Include inactive</option>
              <option value="deceased_only">Deceased only</option>
              <option value="all">All</option>
            </NativeSelect>
          </div>
          <div className="grid grid-cols-12 gap-3">
            <div className="nc-form-group col-span-6">
              <label htmlFor="nc-registry-age-min">Age from</label>
              <Input
                id="nc-registry-age-min"
                type="number"
                className="h-8"
                min={0}
                value={filters.age_today_min}
                onChange={(e) => setField(onFiltersChange, 'age_today_min', e.target.value)}
              />
            </div>
            <div className="nc-form-group col-span-6">
              <label htmlFor="nc-registry-age-max">Age to</label>
              <Input
                id="nc-registry-age-max"
                type="number"
                className="h-8"
                min={0}
                value={filters.age_today_max}
                onChange={(e) => setField(onFiltersChange, 'age_today_max', e.target.value)}
              />
            </div>
          </div>
          <div className="nc-form-group">
            <label htmlFor="nc-registry-sex">Sex</label>
            <NativeSelect
              id="nc-registry-sex"
              className="h-8"
              value={filters.sex}
              onChange={(e) => setField(onFiltersChange, 'sex', e.target.value)}
            >
              <option value="any">Any</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </NativeSelect>
          </div>
          <div className="nc-form-group">
            <label htmlFor="nc-registry-name">Name contains</label>
            <Input
              id="nc-registry-name"
              type="search"
              className="h-8"
              value={filters.name_contains}
              onChange={(e) => setField(onFiltersChange, 'name_contains', e.target.value)}
            />
          </div>
          <div className="nc-form-group">
            <label htmlFor="nc-registry-mrn">MRN</label>
            <Input
              id="nc-registry-mrn"
              type="search"
              className="h-8"
              value={filters.mrn}
              onChange={(e) => setField(onFiltersChange, 'mrn', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-12 gap-3">
            <div className="nc-form-group col-span-6">
              <label htmlFor="nc-registry-national-id">National ID</label>
              <Input
                id="nc-registry-national-id"
                type="search"
                className="h-8"
                value={filters.national_id}
                onChange={(e) => setField(onFiltersChange, 'national_id', e.target.value)}
              />
            </div>
            <div className="nc-form-group col-span-6">
              <label htmlFor="nc-registry-nhis">NHIS number</label>
              <Input
                id="nc-registry-nhis"
                type="search"
                className="h-8"
                value={filters.nhis_number}
                onChange={(e) => setField(onFiltersChange, 'nhis_number', e.target.value)}
              />
            </div>
          </div>
          <div className="nc-form-group">
            <label htmlFor="nc-registry-phone">Phone</label>
            <Input
              id="nc-registry-phone"
              type="search"
              className="h-8"
              value={filters.phone}
              onChange={(e) => setField(onFiltersChange, 'phone', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-12 gap-3">
            <div className="nc-form-group col-span-6">
              <label htmlFor="nc-registry-completion-min">Completion % min</label>
              <Input
                id="nc-registry-completion-min"
                type="number"
                className="h-8"
                min={0}
                max={100}
                value={filters.completion_min}
                onChange={(e) => setField(onFiltersChange, 'completion_min', e.target.value)}
              />
            </div>
            <div className="nc-form-group col-span-6">
              <label htmlFor="nc-registry-completion-max">Completion % max</label>
              <Input
                id="nc-registry-completion-max"
                type="number"
                className="h-8"
                min={0}
                max={100}
                value={filters.completion_max}
                onChange={(e) => setField(onFiltersChange, 'completion_max', e.target.value)}
              />
            </div>
          </div>
          <div className="nc-form-group">
            <label htmlFor="nc-registry-active-visit">Active visit today</label>
            <NativeSelect
              id="nc-registry-active-visit"
              className="h-8"
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
            </NativeSelect>
          </div>

          <details className="nc-registry-visit-filters mb-2">
            <summary className="text-sm font-bold">Visit filters</summary>
            <div className="mt-2">
              <div className="nc-form-group">
                <label htmlFor="nc-registry-visit-states">Visit state</label>
                <NativeSelect
                  id="nc-registry-visit-states"
                  className="h-8"
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
                </NativeSelect>
                <span className="text-sm text-[var(--oe-nc-text-muted)]">Ctrl+click to select multiple</span>
              </div>
              <div className="nc-form-group">
                <label htmlFor="nc-registry-visit-type">Visit type</label>
                <NativeSelect
                  id="nc-registry-visit-type"
                  className="h-8"
                  value={filters.visit_type_id}
                  onChange={(e) => setField(onFiltersChange, 'visit_type_id', e.target.value)}
                >
                  <option value="">Any</option>
                  {visitTypes.map((type) => (
                    <option key={type.id} value={String(type.id)}>
                      {type.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-visit-from">Visit from</label>
                  <Input
                    id="nc-registry-visit-from"
                    type="date"
                    className="h-8"
                    value={filters.visit_date_from}
                    onChange={(e) => setField(onFiltersChange, 'visit_date_from', e.target.value)}
                  />
                </div>
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-visit-to">Visit to</label>
                  <Input
                    id="nc-registry-visit-to"
                    type="date"
                    className="h-8"
                    value={filters.visit_date_to}
                    onChange={(e) => setField(onFiltersChange, 'visit_date_to', e.target.value)}
                  />
                </div>
              </div>
              <div className="nc-form-group">
                <label htmlFor="nc-registry-payment">Payment status</label>
                <NativeSelect
                  id="nc-registry-payment"
                  className="h-8"
                  value={filters.payment_status}
                  onChange={(e) => setField(onFiltersChange, 'payment_status', e.target.value)}
                >
                  <option value="any">Any</option>
                  <option value="paid">Paid</option>
                  <option value="outstanding">Outstanding</option>
                </NativeSelect>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-last-visit-from">Last visit from</label>
                  <Input
                    id="nc-registry-last-visit-from"
                    type="date"
                    className="h-8"
                    value={filters.last_visit_from}
                    onChange={(e) => setField(onFiltersChange, 'last_visit_from', e.target.value)}
                  />
                </div>
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-last-visit-to">Last visit to</label>
                  <Input
                    id="nc-registry-last-visit-to"
                    type="date"
                    className="h-8"
                    value={filters.last_visit_to}
                    onChange={(e) => setField(onFiltersChange, 'last_visit_to', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </details>

          <details className="nc-registry-clinical-filters mb-2">
            <summary className="text-sm font-bold">Clinical filters</summary>
            <div className="mt-2">
              <div className="nc-form-group">
                <label htmlFor="nc-registry-condition-key">Condition</label>
                <NativeSelect
                  id="nc-registry-condition-key"
                  className="h-8"
                  value={filters.condition_key}
                  onChange={(e) => setField(onFiltersChange, 'condition_key', e.target.value)}
                >
                  <option value="">Any / manual below</option>
                  {conditionMap.map((row) => (
                    <option key={row.key} value={row.key}>
                      {row.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="nc-form-group">
                <label htmlFor="nc-registry-problem-title">Problem title contains</label>
                <Input
                  id="nc-registry-problem-title"
                  type="search"
                  className="h-8"
                  placeholder="e.g. malaria"
                  value={filters.problem_title_contains}
                  onChange={(e) => setField(onFiltersChange, 'problem_title_contains', e.target.value)}
                />
              </div>
              <div className="nc-form-group">
                <label htmlFor="nc-registry-icd-prefix">ICD prefix</label>
                <Input
                  id="nc-registry-icd-prefix"
                  type="search"
                  className="h-8"
                  placeholder="e.g. B50"
                  value={filters.icd_prefix}
                  onChange={(e) => setField(onFiltersChange, 'icd_prefix', e.target.value)}
                />
              </div>
              <div className="nc-form-group">
                <label htmlFor="nc-registry-lab-test">Lab test contains</label>
                <Input
                  id="nc-registry-lab-test"
                  type="search"
                  className="h-8"
                  placeholder="e.g. malaria RDT"
                  value={filters.lab_test_contains}
                  onChange={(e) => setField(onFiltersChange, 'lab_test_contains', e.target.value)}
                />
              </div>
              <div className="nc-form-group">
                <label htmlFor="nc-registry-confirmation-source">Confirmation source</label>
                <NativeSelect
                  id="nc-registry-confirmation-source"
                  className="h-8"
                  value={filters.confirmation_source}
                  onChange={(e) => setField(onFiltersChange, 'confirmation_source', e.target.value)}
                >
                  {confirmationSources.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-age-dx-min">Age at diagnosis from</label>
                  <Input
                    id="nc-registry-age-dx-min"
                    type="number"
                    className="h-8"
                    min={0}
                    max={120}
                    value={filters.age_at_diagnosis_min}
                    onChange={(e) => setField(onFiltersChange, 'age_at_diagnosis_min', e.target.value)}
                  />
                </div>
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-age-dx-max">Age at diagnosis to</label>
                  <Input
                    id="nc-registry-age-dx-max"
                    type="number"
                    className="h-8"
                    min={0}
                    max={120}
                    value={filters.age_at_diagnosis_max}
                    onChange={(e) => setField(onFiltersChange, 'age_at_diagnosis_max', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-diagnosis-from">Diagnosis from</label>
                  <Input
                    id="nc-registry-diagnosis-from"
                    type="date"
                    className="h-8"
                    value={filters.diagnosis_date_from}
                    onChange={(e) => setField(onFiltersChange, 'diagnosis_date_from', e.target.value)}
                  />
                </div>
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-diagnosis-to">Diagnosis to</label>
                  <Input
                    id="nc-registry-diagnosis-to"
                    type="date"
                    className="h-8"
                    value={filters.diagnosis_date_to}
                    onChange={(e) => setField(onFiltersChange, 'diagnosis_date_to', e.target.value)}
                  />
                </div>
              </div>
              <div className="nc-form-group">
                <label htmlFor="nc-registry-allergy-substance">Allergy substance contains</label>
                <Input
                  id="nc-registry-allergy-substance"
                  type="search"
                  className="h-8"
                  placeholder="e.g. penicillin"
                  value={filters.allergy_substance_contains}
                  onChange={(e) => setField(onFiltersChange, 'allergy_substance_contains', e.target.value)}
                />
              </div>
              <div className="nc-form-group">
                <label htmlFor="nc-registry-medication">Medication contains</label>
                <Input
                  id="nc-registry-medication"
                  type="search"
                  className="h-8"
                  placeholder="e.g. amoxicillin"
                  value={filters.medication_contains}
                  onChange={(e) => setField(onFiltersChange, 'medication_contains', e.target.value)}
                />
              </div>
            </div>
          </details>

          <details className="nc-registry-comms-filters mb-2">
            <summary className="text-sm font-bold">Communications</summary>
            <div className="mt-2">
              <div className="nc-form-group">
                <label htmlFor="nc-registry-unread-message">Unread staff message (for me)</label>
                <NativeSelect
                  id="nc-registry-unread-message"
                  className="h-8"
                  value={filters.unread_staff_message}
                  onChange={(e) => setField(onFiltersChange, 'unread_staff_message', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </NativeSelect>
              </div>
              <div className="nc-form-group">
                <label htmlFor="nc-registry-open-reminder">Open dated reminder (for me)</label>
                <NativeSelect
                  id="nc-registry-open-reminder"
                  className="h-8"
                  value={filters.open_dated_reminder}
                  onChange={(e) => setField(onFiltersChange, 'open_dated_reminder', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </NativeSelect>
              </div>
            </div>
          </details>

          <details className="nc-registry-scheduling-filters mb-2">
            <summary className="text-sm font-bold">Scheduling & recalls</summary>
            <div className="mt-2">
              <div className="nc-form-group">
                <label htmlFor="nc-registry-appointment-today">Appointment today</label>
                <NativeSelect
                  id="nc-registry-appointment-today"
                  className="h-8"
                  value={filters.appointment_today}
                  onChange={(e) => setField(onFiltersChange, 'appointment_today', e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </NativeSelect>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-appointment-from">Appointment from</label>
                  <Input
                    id="nc-registry-appointment-from"
                    type="date"
                    className="h-8"
                    value={filters.appointment_date_from}
                    onChange={(e) => setField(onFiltersChange, 'appointment_date_from', e.target.value)}
                  />
                </div>
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-appointment-to">Appointment to</label>
                  <Input
                    id="nc-registry-appointment-to"
                    type="date"
                    className="h-8"
                    value={filters.appointment_date_to}
                    onChange={(e) => setField(onFiltersChange, 'appointment_date_to', e.target.value)}
                  />
                </div>
              </div>
              <div className="nc-form-group">
                <label htmlFor="nc-registry-recall-due">Recall due</label>
                <NativeSelect
                  id="nc-registry-recall-due"
                  className="h-8"
                  value={filters.recall_due}
                  onChange={(e) => setField(onFiltersChange, 'recall_due', e.target.value)}
                >
                  <option value="any">Any</option>
                  <option value="overdue">Overdue</option>
                  <option value="due_soon">Due soon (14 days)</option>
                </NativeSelect>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-recall-from">Recall from</label>
                  <Input
                    id="nc-registry-recall-from"
                    type="date"
                    className="h-8"
                    value={filters.recall_date_from}
                    onChange={(e) => setField(onFiltersChange, 'recall_date_from', e.target.value)}
                  />
                </div>
                <div className="nc-form-group col-span-6">
                  <label htmlFor="nc-registry-recall-to">Recall to</label>
                  <Input
                    id="nc-registry-recall-to"
                    type="date"
                    className="h-8"
                    value={filters.recall_date_to}
                    onChange={(e) => setField(onFiltersChange, 'recall_date_to', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </details>

          <div className="flex">
            <Button type="button" size="sm" className="mr-2" onClick={onApply}>
              Apply
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClear}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
