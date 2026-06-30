import { useId } from 'react';

export interface RowActionItem {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface RowActionsMenuProps {
  /** Accessible name for the trigger (e.g. "Actions for Jane Doe"). */
  label: string;
  items: RowActionItem[];
  align?: 'left' | 'right';
}

export function RowActionsMenu({ label, items, align = 'right' }: RowActionsMenuProps) {
  const menuId = useId();

  if (!items.length) return null;

  return (
    <div className={`dropdown oe-nc-row-actions${align === 'right' ? ' text-right' : ''}`}>
      <button
        type="button"
        className="btn btn-link btn-sm p-0 oe-nc-row-actions__trigger"
        id={menuId}
        data-toggle="dropdown"
        aria-haspopup="true"
        aria-expanded="false"
        aria-label={label}
      >
        <i className="fa fa-ellipsis-v" aria-hidden="true" />
      </button>
      <div className="dropdown-menu dropdown-menu-right" aria-labelledby={menuId}>
        {items.map((item) => {
          const className = item.destructive ? 'dropdown-item text-danger' : 'dropdown-item';

          if (item.href) {
            return (
              <a
                key={item.id}
                className={className}
                href={item.href}
                target="_top"
                onClick={item.onClick}
              >
                {item.label}
              </a>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              className={className}
              disabled={item.disabled}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
