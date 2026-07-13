/**
 * Same-origin, CSRF-aware fetch wrapper for OpenEMR AJAX endpoints.
 *
 * Used by all React islands to call `ajax.php?action=<name>` from the New
 * Clinic module. Page context (`ajaxUrl`, `csrfToken`) comes from island
 * `data-props` or `#nc-t1` dataset attributes.
 *
 * Contract with the backend:
 * - All staff-facing AJAX endpoints are session-authenticated.
 * - POST bodies must include `csrf_token_form` (legacy jQuery convention).
 *   oeFetch injects it automatically when absent.
 * - Responses follow the project envelope `{ success, data | error }`.
 */

import { readPageContext } from './types';
import { notePollRateLimited } from './pollBackoff';

export interface OeFetchOptions extends Omit<RequestInit, 'body'> {
  /** Object body — will be JSON-encoded automatically. */
  json?: unknown;
  /** Raw body — passed through untouched. */
  body?: BodyInit;
  /** Override the AJAX URL resolved from the page. Used in tests. */
  ajaxUrl?: string;
  /** Override the CSRF token resolved from the page. Used in tests. */
  csrfToken?: string;
  /** Extra GET query params appended after `?action=<name>`. Null/undefined values are omitted. */
  params?: Record<string, string | number | null | undefined>;
}

export interface OeEnvelopeSuccess<T> {
  success: true;
  message: string;
  data: T;
}

/**
 * Actual server envelope for error responses.
 * AjaxController::respond() outputs: { success: false, message: string, data: [] }
 * (no nested `error` object — message is top-level).
 */
export interface OeEnvelopeError {
  success: false;
  message: string;
  data?: unknown;
}

export type OeEnvelope<T> = OeEnvelopeSuccess<T> | OeEnvelopeError;

export class OeFetchError extends Error {
  public readonly status: number;
  public readonly code: string;
  /** Present on rate-limit (429) responses — ms until the budget window rolls over. */
  public readonly retryAfterMs?: number;

  public constructor(message: string, status: number, code: string, retryAfterMs?: number) {
    super(message);
    this.name = 'OeFetchError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

function envelopeRetryAfterMs(data: unknown): number | undefined {
  if (data !== null && typeof data === 'object' && 'retry_after_ms' in data) {
    const ms = (data as { retry_after_ms?: unknown }).retry_after_ms;
    if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) return ms;
  }
  return undefined;
}

function envelopeErrorCode(data: unknown): string {
  if (data !== null && typeof data === 'object' && 'code' in data) {
    const code = (data as { code?: unknown }).code;
    if (typeof code === 'string' && code !== '') return code;
  }
  return 'api_error';
}

/** Merge csrf_token_form into JSON POST bodies when not already present. */
export function withCsrfBody(json: unknown, csrfToken: string, method: string): unknown {
  if (method === 'GET' || json === undefined) return json;
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return json;

  const obj = json as Record<string, unknown>;
  const existing = String(obj.csrf_token_form ?? obj.csrf_token ?? '').trim();
  if (existing !== '') return json;
  if (csrfToken.trim() === '') return json;

  return { ...obj, csrf_token_form: csrfToken };
}

function resolveCsrfToken(explicit?: string): string {
  const fromOptions = explicit?.trim() ?? '';
  if (fromOptions !== '') return fromOptions;

  const fromShell = readPageContext()?.csrfToken?.trim() ?? '';
  return fromShell;
}

function parseEnvelope<T>(raw: string): OeEnvelope<T> | null {
  try {
    return JSON.parse(raw) as OeEnvelope<T>;
  } catch {
    return null;
  }
}

/**
 * Issue a JSON request to an OpenEMR AJAX endpoint and unwrap the
 * standard `{ success, data }` envelope. Throws `OeFetchError` on
 * any non-2xx status or `success: false` payload.
 */
export async function oeFetch<T>(
  action: string,
  options: OeFetchOptions = {}
): Promise<T> {
  const ctx = readPageContext();
  const ajaxUrl = options.ajaxUrl ?? ctx?.ajaxUrl ?? '';
  const csrfToken = resolveCsrfToken(options.csrfToken ?? ctx?.csrfToken);

  if (ajaxUrl === '') {
    throw new OeFetchError(
      'oeFetch called outside an OpenEMR page (no ajax_url found)',
      0,
      'missing_page_context'
    );
  }

  const extraParams = options.params
    ? Object.entries(options.params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('')
    : '';
  const url = `${ajaxUrl}?action=${encodeURIComponent(action)}${extraParams}`;
  const method = (options.method ?? (options.json !== undefined ? 'POST' : 'GET')).toUpperCase();

  const headers = new Headers(options.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const jsonBody = withCsrfBody(options.json, csrfToken, method);
  if (jsonBody !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (csrfToken !== '' && method !== 'GET' && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const body =
    jsonBody !== undefined ? JSON.stringify(jsonBody) : options.body;

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    body,
    credentials: 'same-origin',
  });

  const raw = await response.text();
  const envelope = parseEnvelope<T>(raw);

  if (!response.ok) {
    const message = envelope && envelope.success === false && envelope.message
      ? envelope.message
      : `Request failed: ${response.status} ${response.statusText}`;
    const code = envelope && envelope.success === false
      ? envelopeErrorCode(envelope.data)
      : 'http_error';
    const retryAfterMs = envelope && envelope.success === false
      ? envelopeRetryAfterMs(envelope.data)
      : undefined;
    // SCALE-3.2 — a 429 carrying retry_after_ms is the poll limiter: pause
    // recurring polls tab-wide until the budget window rolls over.
    if (response.status === 429 && retryAfterMs !== undefined) {
      notePollRateLimited(retryAfterMs);
    }
    throw new OeFetchError(message, response.status, code, retryAfterMs);
  }

  if (!envelope || !envelope.success) {
    throw new OeFetchError(
      envelope?.message || 'Server returned an error',
      response.status,
      envelope ? envelopeErrorCode(envelope.data) : 'api_error'
    );
  }
  return envelope.data;
}
