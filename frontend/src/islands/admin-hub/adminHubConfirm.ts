import type { FormsCatalogItem, VisitTypeRow, FeeScheduleRow } from './adminTypes';
import type { AdminScope } from './adminTypes';

export type AdminConfirm =
  | { type: 'scope_switch'; nextScope: AdminScope }
  | { type: 'archive_visit_type'; row: VisitTypeRow }
  | { type: 'archive_fee'; row: FeeScheduleRow }
  | { type: 'grant_roles' }
  | { type: 'cash_profile' }
  | { type: 'catalog_enable'; item: FormsCatalogItem };
