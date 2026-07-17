import { useEffect } from 'react';
import { t } from '@core/i18n';
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
  /** Top-right primary action ("+ New message") — messages lens only. */
  onCompose: () => void;
  /** Top-right primary action ("+ New reminder") — reminders lens only. */
  onCreateReminder: () => void;
  /** Toolbar secondary ("View log") — reminders lens only. */
  onViewLog: () => void;
}

/** The single sort select's values, mapped to the service's sortby/sortorder
 *  pair (the preference payload shape is unchanged, so stored prefs keep
 *  working; unknown stored combos fall back to newest-first). */
const SORT_VALUE_TO_SORT: Record<string, CommHubSort> = {
  date_desc: { sortby: 'pnotes.date', sortorder: 'desc' },
  date_asc: { sortby: 'pnotes.date', sortorder: 'asc' },
  patient_az: { sortby: 'patient_data.lname', sortorder: 'asc' },
  from_az: { sortby: 'users.lname', sortorder: 'asc' },
  type_az: { sortby: 'pnotes.title', sortorder: 'asc' },
};

function sortToSelectValue(sort: CommHubSort): string {
  const match = Object.entries(SORT_VALUE_TO_SORT).find(
    ([, candidate]) => candidate.sortby === sort.sortby && candidate.sortorder === sort.sortorder,
  );
  return match ? match[0] : 'date_desc';
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
  onCompose,
  onCreateReminder,
  onViewLog,
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

    const isMessages = lens === 'messages';

    const activityEl = document.getElementById('nc-comm-activity');
    if (activityEl) activityEl.classList.toggle('nc-hidden', !isMessages);

    const scopeWrap = document.getElementById('nc-comm-scope-wrap');
    if (scopeWrap) scopeWrap.classList.toggle('nc-hidden', !isMessages || !canViewAllUsers);

    const sortEl = document.getElementById('nc-comm-sort');
    if (sortEl) sortEl.classList.toggle('nc-hidden', !isMessages);

    // Lens-scoped toolbar actions: the primary action swaps with the lens,
    // and "View log" only exists for reminders.
    const newMessage = document.getElementById('nc-comm-new-message');
    if (newMessage) newMessage.classList.toggle('nc-hidden', !isMessages);

    const newReminder = document.getElementById('nc-comm-new-reminder');
    if (newReminder) newReminder.classList.toggle('nc-hidden', isMessages);

    const viewLog = document.getElementById('nc-comm-view-log');
    if (viewLog) viewLog.classList.toggle('nc-hidden', isMessages);

    const search = document.getElementById('nc-comm-search') as HTMLInputElement | null;
    if (search) {
      search.placeholder = isMessages ? t('Search messages…') : t('Filter reminders…');
    }
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

    const sortEl = document.getElementById('nc-comm-sort') as HTMLSelectElement | null;
    const sortValue = sortToSelectValue(sort);
    if (sortEl && sortEl.value !== sortValue) {
      sortEl.value = sortValue;
    }
  }, [activity, showAll, sort]);

  useEffect(() => {
    const cleanups = [
      bindClick('nc-comm-lens-messages', () => onLensChange('messages')),
      bindClick('nc-comm-lens-reminders', () => onLensChange('reminders')),
      bindClick('nc-comm-refresh', onRefresh),
      bindClick('nc-comm-new-message', onCompose),
      bindClick('nc-comm-new-reminder', onCreateReminder),
      bindClick('nc-comm-view-log', onViewLog),
    ];
    return () => {
      cleanups.forEach((cleanup) => cleanup?.());
    };
  }, [onLensChange, onRefresh, onCompose, onCreateReminder, onViewLog]);

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
    const activityEl = document.getElementById('nc-comm-activity') as HTMLSelectElement | null;
    if (!activityEl) return undefined;
    const handler = () => onActivityChange(activityEl.value);
    activityEl.addEventListener('change', handler);
    return () => activityEl.removeEventListener('change', handler);
  }, [onActivityChange]);

  useEffect(() => {
    const showAllEl = document.getElementById('nc-comm-show-all') as HTMLInputElement | null;
    if (!showAllEl) return undefined;
    const handler = () => onShowAllChange(showAllEl.checked);
    showAllEl.addEventListener('change', handler);
    return () => showAllEl.removeEventListener('change', handler);
  }, [onShowAllChange]);

  useEffect(() => {
    const sortEl = document.getElementById('nc-comm-sort') as HTMLSelectElement | null;
    if (!sortEl) return undefined;

    const handler = () => {
      onSortChange(SORT_VALUE_TO_SORT[sortEl.value] ?? SORT_VALUE_TO_SORT.date_desc);
    };
    sortEl.addEventListener('change', handler);
    return () => sortEl.removeEventListener('change', handler);
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
