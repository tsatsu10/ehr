import type { PeopleSubTabId } from './peopleTypes';

const MODULE_PUBLIC = '/interface/modules/custom_modules/oe-module-new-clinic/public';

export function peopleLegacyUrl(
  webroot: string,
  view: string,
  sub: PeopleSubTabId = 'staff',
  params: Record<string, string | number> = {},
): string {
  const root = webroot.replace(/\/$/, '');
  const url = new URL(`${root}${MODULE_PUBLIC}/admin-people-legacy.php`, window.location.origin);
  url.searchParams.set('view', view);
  url.searchParams.set('sub', sub);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return `${url.pathname}${url.search}`;
}

export function adminPeopleTabUrl(sub: PeopleSubTabId = 'staff'): string {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', 'people');
  url.searchParams.set('sub', sub);
  return `${url.pathname}${url.search}`;
}

export function initialPeopleSubTab(): PeopleSubTabId {
  const fromUrl = new URL(window.location.href).searchParams.get('sub');
  if (fromUrl === 'access' || fromUrl === 'facilities' || fromUrl === 'help' || fromUrl === 'staff') {
    return fromUrl;
  }
  return 'staff';
}
