import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import {
  Building2,
  Coins,
  FileText,
  ListChecks,
  Settings2,
  Tag,
  Upload,
  UserCog,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildAdminTabUrl } from './adminUtils';
import type { AdminTabId } from './adminTypes';

export interface AdminSidebarBadge {
  tone: 'warning' | 'danger';
  label: string;
}

const ICONS: Record<AdminTabId, ReactNode> = {
  queue: <Users className="h-4 w-4" aria-hidden />,
  people: <UserCog className="h-4 w-4" aria-hidden />,
  completion: <ListChecks className="h-4 w-4" aria-hidden />,
  clinic: <Building2 className="h-4 w-4" aria-hidden />,
  forms: <FileText className="h-4 w-4" aria-hidden />,
  system: <Settings2 className="h-4 w-4" aria-hidden />,
  types: <Tag className="h-4 w-4" aria-hidden />,
  fees: <Coins className="h-4 w-4" aria-hidden />,
  directory: <Users className="h-4 w-4" aria-hidden />,
  import: <Upload className="h-4 w-4" aria-hidden />,
};

/**
 * Presentation-only grouping — matches the target IA (ADM-3 will physically
 * move settings between destinations); groups with no visible items don't
 * render, so gating (system/forms/import) doesn't leave an empty heading.
 */
const GROUP_ORDER: { label: string; ids: AdminTabId[] }[] = [
  { label: 'Clinic', ids: ['queue', 'clinic', 'completion'] },
  { label: 'People & money', ids: ['people', 'types', 'fees', 'directory', 'import'] },
  { label: 'Operations', ids: ['forms', 'system'] },
];

function focusableItems(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>('[data-nc-sidebar-item]'));
}

export function AdminSidebar({
  tabs,
  activeTab,
  onChange,
  badges,
}: {
  tabs: { id: AdminTabId; label: string }[];
  activeTab: AdminTabId;
  onChange: (id: AdminTabId) => void;
  badges?: Partial<Record<AdminTabId, AdminSidebarBadge>>;
}) {
  const visibleIds = new Set(tabs.map((tab) => tab.id));
  const labelById = new Map(tabs.map((tab) => [tab.id, tab.label]));

  const handleItemClick = (event: MouseEvent<HTMLAnchorElement>, id: AdminTabId) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      // Let the browser open a new tab / window for modified clicks.
      return;
    }
    event.preventDefault();
    onChange(id);
  };

  const handleNavKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const items = focusableItems(event.currentTarget);
    if (items.length === 0) {
      return;
    }
    const currentIndex = items.indexOf(document.activeElement as HTMLAnchorElement);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }
    event.preventDefault();
    items[nextIndex]?.focus();
  };

  return (
    // The outer rail stretches to the grid row's full height (Console 26 —
    // the row is as tall as the content column) so the inner sticky nav has
    // room to move within it; sticky on a self-stretched element is inert
    // since its own box would already span the whole page.
    <div className="nc-admin-sidebar-rail">
      <nav
        className="nc-admin-sidebar"
        aria-label="Admin sections"
        onKeyDown={handleNavKeyDown}
      >
        {GROUP_ORDER.map((group) => {
          const groupIds = group.ids.filter((id) => visibleIds.has(id));
          if (groupIds.length === 0) {
            return null;
          }
          return (
            <div className="nc-admin-sidebar__group" key={group.label}>
              <p className="nc-admin-sidebar__group-label">{group.label}</p>
              <ul className="nc-admin-sidebar__list">
                {groupIds.map((id) => {
                  const label = labelById.get(id) ?? id;
                  const active = id === activeTab;
                  const badge = badges?.[id];
                  return (
                    <li key={id}>
                      <a
                        href={buildAdminTabUrl(id)}
                        data-nc-sidebar-item
                        className={cn('nc-admin-sidebar__item', active && 'nc-admin-sidebar__item--active')}
                        aria-current={active ? 'page' : undefined}
                        onClick={(event) => handleItemClick(event, id)}
                      >
                        <span className="nc-admin-sidebar__icon">{ICONS[id]}</span>
                        <span className="nc-admin-sidebar__label">{label}</span>
                        {badge && (
                          <span className={cn('nc-admin-sidebar__badge', `nc-admin-sidebar__badge--${badge.tone}`)}>
                            {badge.label}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
