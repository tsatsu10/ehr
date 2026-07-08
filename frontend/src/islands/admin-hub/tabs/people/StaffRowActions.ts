import type { RowActionItem } from '@components/RowActionsMenu';
import type { StaffRow } from '../../peopleTypes';

export function buildStaffRowActions(
  row: StaffRow,
  handlers: {
    onAccessSummary: (row: StaffRow) => void;
    onDeactivate: (row: StaffRow) => void;
    onAdvancedEdit: (row: StaffRow) => void;
    onResetPassword: (row: StaffRow) => void;
  },
): RowActionItem[] {
  const items: RowActionItem[] = [
    {
      id: 'access',
      label: 'View access summary',
      onClick: () => handlers.onAccessSummary(row),
    },
  ];

  if (row.active) {
    items.push({
      id: 'deactivate',
      label: 'Deactivate',
      destructive: true,
      onClick: () => handlers.onDeactivate(row),
    });
  }

  items.push({
    id: 'advanced',
    label: 'Advanced edit',
    onClick: () => handlers.onAdvancedEdit(row),
  });

  items.push({
    id: 'password',
    label: 'Reset password (advanced)',
    onClick: () => handlers.onResetPassword(row),
  });

  return items;
}
