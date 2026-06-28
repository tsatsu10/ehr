import { useEffect } from 'react';
import type { CommHubSort, CommLens, HubCounts } from './communicationsTypes';

interface PageHeadingOptions {
  lens: CommLens;
  counts: HubCounts;
  canViewAllUsers: boolean;
  activity: string;
  showAll: boolean;
  onLensChange: (lens: CommLens) => void;
  onSearchChange: (query: string) => void;
  onActivityChange: (activity: string) => void;
  onShowAllChange: (showAll: boolean) => void;
  sort: CommHubSort;
  onSortChange: (sort: CommHubSort) => void;
  onRefresh: () => void;
}

function bindClick(id: string, handler: () => void): (() => void) | undefined {
  const el = document.getElementById(id);
  if (!el) return undefined;
  el.addEventListener('click', handler);
  return () => el.removeEventListener('click', handler);
}

/** Wire Twig page-heading toolbar slots for Communications Hub. */
export function useCommunicationsPageHeading({
  lens,
  counts,
  canViewAllUsers,
  activity,
  showAll,
  onLensChange,
  onSearchChange,
  onActivityChange,
  onShowAllChange,
  sort,
  onSortChange,
  onRefresh,
}: PageHeadingOptions): void {
  useEffect(() => {
    const messagesEl = document.getElementById('nc-comm-count-messages');
    const remindersEl = document.getElementById('nc-comm-count-reminders');
    if (messagesEl) messagesEl.textContent = String(counts.messages_active ?? 0);
    if (remindersEl) remindersEl.textContent = String(counts.reminders_in_window ?? 0);
  }, [counts]);

  useEffect(() => {
    const btnMessages = document.getElementById('nc-comm-lens-messages');
    const btnReminders = document.getElementById('nc-comm-lens-reminders');
    if (btnMessages) btnMessages.classList.toggle('active', lens === 'messages');
    if (btnReminders) btnReminders.classList.toggle('active', lens === 'reminders');

    const activity = document.getElementById('nc-comm-activity');
    if (activity) activity.classList.toggle('d-none', lens !== 'messages');

    const scopeWrap = document.getElementById('nc-comm-scope-wrap');
    if (scopeWrap) scopeWrap.classList.toggle('d-none', lens !== 'messages' || !canViewAllUsers);

    const compose = document.getElementById('nc-comm-compose-link');
    if (compose) compose.classList.toggle('d-none', lens !== 'messages');

    const sortBy = document.getElementById('nc-comm-sort-by');
    const sortOrder = document.getElementById('nc-comm-sort-order');
    if (sortBy) sortBy.classList.toggle('d-none', lens !== 'messages');
    if (sortOrder) sortOrder.classList.toggle('d-none', lens !== 'messages');
  }, [canViewAllUsers, lens]);

  useEffect(() => {
    const activityEl = document.getElementById('nc-comm-activity') as HTMLSelectElement | null;
    if (activityEl && activityEl.value !== activity) {
      activityEl.value = activity;
    }

    const showAllEl = document.getElementById('nc-comm-show-all') as HTMLInputElement | null;
    if (showAllEl && showAllEl.checked !== showAll) {
      showAllEl.checked = showAll;
    }

    const sortByEl = document.getElementById('nc-comm-sort-by') as HTMLSelectElement | null;
    if (sortByEl && sortByEl.value !== sort.sortby) {
      sortByEl.value = sort.sortby;
    }

    const sortOrderEl = document.getElementById('nc-comm-sort-order') as HTMLSelectElement | null;
    if (sortOrderEl && sortOrderEl.value !== sort.sortorder) {
      sortOrderEl.value = sort.sortorder;
    }
  }, [activity, showAll, sort.sortby, sort.sortorder]);

  useEffect(() => {
    const cleanupMessages = bindClick('nc-comm-lens-messages', () => onLensChange('messages'));
    const cleanupReminders = bindClick('nc-comm-lens-reminders', () => onLensChange('reminders'));
    const cleanupRefresh = bindClick('nc-comm-refresh', onRefresh);
    return () => {
      cleanupMessages?.();
      cleanupReminders?.();
      cleanupRefresh?.();
    };
  }, [onLensChange, onRefresh]);

  useEffect(() => {
    const search = document.getElementById('nc-comm-search') as HTMLInputElement | null;
    if (!search) return undefined;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onSearchChange(search.value.trim()), 300);
    };
    search.addEventListener('input', handler);
    return () => {
      clearTimeout(timer);
      search.removeEventListener('input', handler);
    };
  }, [onSearchChange]);

  useEffect(() => {
    const activity = document.getElementById('nc-comm-activity') as HTMLSelectElement | null;
    if (!activity) return undefined;
    const handler = () => onActivityChange(activity.value);
    activity.addEventListener('change', handler);
    return () => activity.removeEventListener('change', handler);
  }, [onActivityChange]);

  useEffect(() => {
    const showAll = document.getElementById('nc-comm-show-all') as HTMLInputElement | null;
    if (!showAll) return undefined;
    const handler = () => onShowAllChange(showAll.checked);
    showAll.addEventListener('change', handler);
    return () => showAll.removeEventListener('change', handler);
  }, [onShowAllChange]);

  useEffect(() => {
    const sortBy = document.getElementById('nc-comm-sort-by') as HTMLSelectElement | null;
    const sortOrder = document.getElementById('nc-comm-sort-order') as HTMLSelectElement | null;
    if (!sortBy || !sortOrder) return undefined;

    const handler = () => {
      onSortChange({
        sortby: sortBy.value,
        sortorder: sortOrder.value === 'asc' ? 'asc' : 'desc',
      });
    };
    sortBy.addEventListener('change', handler);
    sortOrder.addEventListener('change', handler);
    return () => {
      sortBy.removeEventListener('change', handler);
      sortOrder.removeEventListener('change', handler);
    };
  }, [onSortChange]);
}

export function openLegacyDialog(url: string, width: number, height: number): void {
  const win = window as Window & { dlgopen?: (url: string, target: string, w: number, h: number) => void };
  if (typeof win.dlgopen === 'function') {
    win.dlgopen(url, '_blank', width, height);
  } else {
    window.open(url, '_blank');
  }
}
