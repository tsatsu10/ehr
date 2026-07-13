import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetI18nForTests,
  __setI18nForTests,
  ensureI18nReady,
  getLangCode,
  t,
} from './i18n';

afterEach(() => {
  __resetI18nForTests();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('t()', () => {
  it('passes English through when no dictionary is loaded', () => {
    expect(t('Add note')).toBe('Add note');
  });

  it('returns the dictionary translation when present', () => {
    __setI18nForTests({ 'Add note': 'Ajouter une note' }, 'fr');
    expect(t('Add note')).toBe('Ajouter une note');
    expect(getLangCode()).toBe('fr');
  });

  it('falls back to English for missing or empty entries', () => {
    __setI18nForTests({ 'Add note': '' }, 'fr');
    expect(t('Add note')).toBe('Add note');
    expect(t('Never extracted')).toBe('Never extracted');
  });

  it('interpolates {name} params after translation', () => {
    expect(t('Showing {start}–{end} of {total}', { start: 1, end: 20, total: 41 })).toBe(
      'Showing 1–20 of 41'
    );
  });

  it('lets translations reorder placeholders', () => {
    __setI18nForTests({ 'Hi {name}, welcome': 'Bienvenue, {name}' }, 'fr');
    expect(t('Hi {name}, welcome', { name: 'Ama' })).toBe('Bienvenue, Ama');
  });

  it('replaces every occurrence of a repeated placeholder', () => {
    expect(t('{n} of {n}', { n: 3 })).toBe('3 of 3');
  });
});

describe('ensureI18nReady()', () => {
  function stampShell(langCode: string, i18nUrl: string): void {
    const shell = document.createElement('div');
    shell.id = 'nc-t1';
    shell.dataset.langCode = langCode;
    shell.dataset.i18nUrl = i18nUrl;
    document.body.appendChild(shell);
  }

  it('resolves without fetching for English', async () => {
    stampShell('en', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await ensureI18nReady();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getLangCode()).toBe('en');
  });

  it('resolves without fetching when no shell root exists (tests, detached mounts)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await ensureI18nReady();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('loads the dictionary for a non-English locale', async () => {
    stampShell('fr', '/assets/i18n/fr.json?v=x');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'Add note': 'Ajouter une note', bogus: 7 }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await ensureI18nReady();

    expect(fetchSpy).toHaveBeenCalledWith('/assets/i18n/fr.json?v=x', {
      credentials: 'same-origin',
    });
    expect(getLangCode()).toBe('fr');
    expect(t('Add note')).toBe('Ajouter une note');
    // Non-string dictionary values are dropped, not crashed on.
    expect(t('bogus')).toBe('bogus');
  });

  it('fails open to English when the dictionary fetch fails', async () => {
    stampShell('fr', '/assets/i18n/fr.json?v=x');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await ensureI18nReady();

    expect(getLangCode()).toBe('fr');
    expect(t('Add note')).toBe('Add note');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('memoizes: repeated calls share one fetch', async () => {
    stampShell('fr', '/assets/i18n/fr.json?v=x');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await Promise.all([ensureI18nReady(), ensureI18nReady()]);
    await ensureI18nReady();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
