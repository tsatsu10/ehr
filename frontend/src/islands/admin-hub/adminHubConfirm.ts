import type { DirectoryContactRow, FormsCatalogItem, VisitTypeRow, FeeScheduleRow } from './adminTypes';
import type { AdminScope, AdminTabId } from './adminTypes';

export type AdminConfirm =
  | { type: 'scope_switch'; nextScope: AdminScope }
  | { type: 'tab_switch'; nextTab: AdminTabId }
  | { type: 'reset_override'; key: string; label: string }
  | { type: 'archive_visit_type'; row: VisitTypeRow }
  | { type: 'archive_fee'; row: FeeScheduleRow }
  | { type: 'grant_roles' }
  | { type: 'cash_profile' }
  | { type: 'catalog_enable'; item: FormsCatalogItem }
  | { type: 'delete_directory_contact'; row: DirectoryContactRow };
