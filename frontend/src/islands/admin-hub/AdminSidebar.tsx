import { useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import {
  Building2,
  CheckCircle2,
  Coins,
  FileText,
  ListChecks,
  Search,
  Settings2,
  SlidersHorizontal,
  Tag,
  Upload,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildAdminTabUrl } from './adminUtils';
import { searchAdminDestinations, searchAdminFields } from './adminSearchIndex';
import type { AdminTabId } from './adminTypes';

export interface AdminSidebarBadge {
  tone: 'warning' | 'danger';
  label: string;
}

const ICONS: Record<AdminTabId, ReactNode> = {
  setup: <CheckCircle2 className="h-4 w-4" aria-hidden />,
  'queue-desks': <Users className="h-4 w-4" aria-hidden />,
  features: <SlidersHorizontal className="h-4 w-4" aria-hidden />,
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

/** Groups with no visible items don't render, so gating (system/forms/import) never leaves an empty heading. */
const GROUP_ORDER: { label: string; ids: AdminTabId[] }[] = [
  { label: 'Get started', ids: ['setup'] },
  { label: 'Clinic', ids: ['queue-desks', 'clinic', 'features', 'completion'] },
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
  onSelectField,
  onSelectDestination,
}: {
  tabs: { id: AdminTabId; label: string }[];
  activeTab: AdminTabId;
  onChange: (id: AdminTabId) => void;
  badges?: Partial<Record<AdminTabId, AdminSidebarBadge>>;
  /** ADM-1: jump to a specific setting from the global search. */
  onSelectField?: (tab: AdminTabId, fieldKey: string) => void;
  /** ADM-1: jump to a whole destination (non-field-def tabs) from search. */
  onSelectDestination?: (tab: AdminTabId) => void;
}) {
  const [query, setQuery] = useState('');
  const visibleIds = new Set(tabs.map((tab) => tab.id));
  const labelById = new Map(tabs.map((tab) => [tab.id, tab.label]));

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length > 0;
  const fieldResults = useMemo(
    () => (searching ? searchAdminFields(trimmedQuery).filter((r) => visibleIds.has(r.tab)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleIds is a new Set every render; tabs is the real dep
    [searching, trimmedQuery, tabs]
  );
  const destinationResults = useMemo(
    () => (searching ? searchAdminDestinations(trimmedQuery).filter((r) => visibleIds.has(r.tab)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleIds is a new Set every render; tabs is the real dep
    [searching, trimmedQuery, tabs]
  );

  const selectField = (tab: AdminTabId, fieldKey: string) => {
    setQuery('');
    onSelectField?.(tab, fieldKey);
  };
  const selectDestination = (tab: AdminTabId) => {
    setQuery('');
    onSelectDestination?.(tab);
  };

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

  const totalResults = fieldResults.length + destinationResults.length;

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
        <div className="nc-admin-sidebar__search">
          <Search className="nc-admin-sidebar__search-icon" aria-hidden />
          <input
            type="search"
            className="nc-admin-sidebar__search-input"
            placeholder="Search settings…"
            aria-label="Search settings"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
          />
          {searching && (
            <button
              type="button"
              aria-label="Clear search"
              className="nc-admin-sidebar__search-clear"
              onClick={() => setQuery('')}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>

        {searching ? (
          totalResults === 0 ? (
            <p className="nc-admin-sidebar__search-empty">No settings match “{trimmedQuery}”.</p>
          ) : (
            <ul className="nc-admin-sidebar__search-results" role="listbox" aria-label="Search results">
              {fieldResults.map((result) => (
                <li key={result.fieldKey}>
                  <button
                    type="button"
                    className="nc-admin-sidebar__search-result"
                    onClick={() => selectField(result.tab, result.fieldKey)}
                  >
                    <span className="nc-admin-sidebar__search-result-label">{result.label}</span>
                    <span className="nc-admin-sidebar__search-result-path">
                      in {result.tabLabel}{result.groupTitle ? ` › ${result.groupTitle}` : ''}
                    </span>
                  </button>
                </li>
              ))}
              {destinationResults.map((result) => (
                <li key={result.tab}>
                  <button
                    type="button"
                    className="nc-admin-sidebar__search-result"
                    onClick={() => selectDestination(result.tab)}
                  >
                    <span className="nc-admin-sidebar__search-result-label">{result.tabLabel}</span>
                    <span className="nc-admin-sidebar__search-result-path">{result.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : GROUP_ORDER.map((group) => {
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
