import { describe, expect, it, vi, afterEach } from 'vitest';
import { oeFetch, withCsrfBody, OeFetchError } from './oeFetch';

describe('withCsrfBody', () => {
  it('adds csrf_token_form to POST JSON objects', () => {
    expect(withCsrfBody({ visit_id: 1 }, 'tok-abc', 'POST')).toEqual({
      visit_id: 1,
      csrf_token_form: 'tok-abc',
    });
  });

  it('does not overwrite an existing csrf_token_form', () => {
    expect(withCsrfBody({ csrf_token_form: 'keep' }, 'tok-abc', 'POST')).toEqual({
      csrf_token_form: 'keep',
    });
  });

  it('skips GET requests', () => {
    expect(withCsrfBody({ q: 'x' }, 'tok-abc', 'GET')).toEqual({ q: 'x' });
  });
});

describe('oeFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes csrf_token_form in POST JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, message: 'ok', data: { ok: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await oeFetch('patients.search', {
      ajaxUrl: '/ajax.php',
      csrfToken: 'csrf-123',
      method: 'POST',
      json: { q: 'ama', limit: 8 },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      q: 'ama',
      limit: 8,
      csrf_token_form: 'csrf-123',
    });
  });

  it('surfaces server message on 403 instead of generic HTTP text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => JSON.stringify({
        success: false,
        message: 'Invalid CSRF token',
        data: { code: 'csrf' },
      }),
    }));

    await expect(
      oeFetch('patients.search', {
        ajaxUrl: '/ajax.php',
        csrfToken: 'bad',
        method: 'POST',
        json: { q: 'x' },
      })
    ).rejects.toMatchObject({
      message: 'Invalid CSRF token',
      status: 403,
      code: 'csrf',
    } satisfies Partial<OeFetchError>);
  });
});
