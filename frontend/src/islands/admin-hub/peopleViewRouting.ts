import type { PeopleSubTabId } from './peopleTypes';

export type PeopleViewId =
  | 'membership'
  | 'group-perms'
  | 'advanced-users'
  | 'gacl'
  | 'acl-help'
  | 'reset-password'
  | 'facility-matrix';

export const PEOPLE_VIEW_META: Record<PeopleViewId, { sub: PeopleSubTabId; title: string }> = {
  membership: { sub: 'access', title: 'Assign user to group' },
  'group-perms': { sub: 'access', title: 'Edit group permissions' },
  'advanced-users': { sub: 'staff', title: 'Advanced user admin' },
  'reset-password': { sub: 'staff', title: 'Reset password' },
  gacl: { sub: 'access', title: 'Advanced GACL' },
  'acl-help': { sub: 'help', title: 'Access control list help' },
  'facility-matrix': { sub: 'facilities', title: 'Facility user matrix' },
};

export function initialPeopleView(): PeopleViewId | null {
  const view = new URL(window.location.href).searchParams.get('view');
  if (view && view in PEOPLE_VIEW_META) {
    return view as PeopleViewId;
  }
  return null;
}

export function peopleViewUrl(sub: PeopleSubTabId, view: PeopleViewId | null): string {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', 'people');
  url.searchParams.set('sub', sub);
  if (view) {
    url.searchParams.set('view', view);
  } else {
    url.searchParams.delete('view');
  }
  return `${url.pathname}${url.search}`;
}

export function initialPeopleRoute(): { sub: PeopleSubTabId; view: PeopleViewId | null } {
  const view = initialPeopleView();
  if (view) {
    return { sub: PEOPLE_VIEW_META[view].sub, view };
  }
  const fromUrl = new URL(window.location.href).searchParams.get('sub');
  if (fromUrl === 'access' || fromUrl === 'staff' || fromUrl === 'facilities' || fromUrl === 'help') {
    return { sub: fromUrl, view: null };
  }
  return { sub: 'staff', view: null };
}

export function clearPeopleViewUrl(sub: PeopleSubTabId): string {
  return peopleViewUrl(sub, null);
}
