import { afterEach, describe, expect, it } from 'vitest';
import { buildAdminTabUrl, initialAdminTab } from './adminUtils';

// Path-only (not a full URL with a different host) — jsdom's replaceState
// throws a SecurityError on a cross-origin target, and the test origin is
// whatever jsdom's default document URL is, not "localhost" bare.
function setUrl(pathAndQuery: string) {
  window.history.replaceState({}, '', pathAndQuery);
}

describe('initialAdminTab', () => {
  afterEach(() => {
    setUrl('/admin.php');
  });

  it('defaults to queue-desks with no ?tab= param', () => {
    setUrl('/admin.php');
    expect(initialAdminTab()).toBe('queue-desks');
  });

  it('redirects the retired "queue" tab id to queue-desks (ADM-3 mega-tab split)', () => {
    setUrl('/admin.php?tab=queue');
    expect(initialAdminTab()).toBe('queue-desks');
  });

  it('redirects the legacy "roles" tab id to people', () => {
    setUrl('/admin.php?tab=roles');
    expect(initialAdminTab()).toBe('people');
  });

  it('redirects an old System-tab setup-checklist anchor link to the Setup tab', () => {
    setUrl('/admin.php?tab=system#nc-admin-setup-checklist');
    expect(initialAdminTab()).toBe('setup');
  });

  it('leaves a bare ?tab=system link on System (no checklist anchor)', () => {
    setUrl('/admin.php?tab=system');
    expect(initialAdminTab()).toBe('system');
  });

  it('passes through any other explicit tab id unchanged', () => {
    setUrl('/admin.php?tab=fees');
    expect(initialAdminTab()).toBe('fees');
  });
});

describe('buildAdminTabUrl', () => {
  afterEach(() => {
    setUrl('/admin.php');
  });

  it('omits ?tab= for queue-desks (the clean-URL default)', () => {
    setUrl('/admin.php?tab=fees');
    expect(buildAdminTabUrl('queue-desks')).toBe(`${window.location.origin}/admin.php`);
  });

  it('sets ?tab= for every other destination', () => {
    setUrl('/admin.php');
    expect(buildAdminTabUrl('setup')).toBe(`${window.location.origin}/admin.php?tab=setup`);
    expect(buildAdminTabUrl('features')).toBe(`${window.location.origin}/admin.php?tab=features`);
  });
});
