import { Button } from '@components/ui/button';
import { PeopleInfoCallout } from '../../peopleUi';

export interface AclListItem {
  id: string;
  label: string;
}

interface AclDualListColumnProps {
  title: string;
  hint: string;
  items: AclListItem[];
  selected: string[];
  emptyLabel: string;
  actionLabel: string;
  actionVariant?: 'default' | 'outline';
  busy?: boolean;
  onToggle: (id: string) => void;
  onAction: () => void;
}

export function AclDualListColumn({
  title,
  hint,
  items,
  selected,
  emptyLabel,
  actionLabel,
  actionVariant = 'outline',
  busy = false,
  onToggle,
  onAction,
}: AclDualListColumnProps) {
  return (
    <div className="rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-4">
      <h3 className="text-sm font-semibold text-[var(--oe-nc-text)]">{title}</h3>
      <PeopleInfoCallout>{hint}</PeopleInfoCallout>
      <ul
        className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-md border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] p-2"
        role="listbox"
        aria-label={title}
        aria-multiselectable="true"
      >
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm transition-colors hover:bg-white">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
        {!items.length && (
          <li className="px-1 py-2 text-sm text-[var(--oe-nc-text-muted)]">{emptyLabel}</li>
        )}
      </ul>
      <Button
        type="button"
        variant={actionVariant}
        size="sm"
        className="mt-3"
        disabled={busy || !selected.length}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
