import { NativeSelect } from '@components/ui/native-select';
import {
  REGISTRY_PAGE_SIZES,
  REGISTRY_SORT_OPTIONS,
  type RegistryPageSize,
  type RegistrySortKey,
} from './registryQueryOptions';

interface RegistryResultsToolbarProps {
  sort: RegistrySortKey;
  pageSize: RegistryPageSize;
  onSortChange: (sort: RegistrySortKey) => void;
  onPageSizeChange: (pageSize: RegistryPageSize) => void;
}

export function RegistryResultsToolbar({
  sort,
  pageSize,
  onSortChange,
  onPageSizeChange,
}: RegistryResultsToolbarProps) {
  return (
    <div className="nc-registry-results-toolbar">
      <div className="nc-form-group nc-registry-results-toolbar__field">
        <label htmlFor="nc-registry-sort">Sort by</label>
        <NativeSelect
          id="nc-registry-sort"
          className="h-8"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as RegistrySortKey)}
        >
          {REGISTRY_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="nc-form-group nc-registry-results-toolbar__field">
        <label htmlFor="nc-registry-page-size">Rows per page</label>
        <NativeSelect
          id="nc-registry-page-size"
          className="h-8"
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number.parseInt(event.target.value, 10) as RegistryPageSize)}
        >
          {REGISTRY_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
