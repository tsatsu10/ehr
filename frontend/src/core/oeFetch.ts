/**
 * Same-origin, CSRF-aware fetch wrapper for OpenEMR AJAX endpoints.
 *
 * Used by all React islands to call `ajax.php?action=<name>` from the New
 * Clinic module. Page context (`ajaxUrl`, `csrfToken`) comes from island
 * `data-props` or `#oe-nc-t1` dataset attributes.
 *
 * Contract with the backend:
 * - All staff-facing AJAX endpoints are session-authenticated.
 * - POST bodies must include `csrf_token_form` (legacy jQuery convention).
 *   oeFetch injects it automatically when absent.
 * - Responses follow the project envelope `{ success, data | error }`.
 */

import { readPageContext } from './types';

export interface OeFetchOptions extends Omit<RequestInit, 'body'> {
  /** Object body — will be JSON-encoded automatically. */
  json?: unknown;
  /** Raw body — passed through untouched. */
  body?: BodyInit;
  /** Override the AJAX URL resolved from the page. Used in tests. */
  ajaxUrl?: string;
  /** Override the CSRF token resolved from the page. Used in tests. */
  csrfToken?: string;
  /** Extra GET query params appended after `?action=<name>`. */
  params?: Record<string, string | number>;
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

  public constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'OeFetchError';
    this.status = status;
    this.code = code;
  }
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
  if (csrfToken === '' || method === 'GET' || json === undefined) return json;
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return json;

  const obj = json as Record<string, unknown>;
  if (obj.csrf_token_form !== undefined || obj.csrf_token !== undefined) return json;

  return { ...obj, csrf_token_form: csrfToken };
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
  const csrfToken = options.csrfToken ?? ctx?.csrfToken ?? '';

  if (ajaxUrl === '') {
    throw new OeFetchError(
      'oeFetch called outside an OpenEMR page (no ajax_url found)',
      0,
      'missing_page_context'
    );
  }

  const extraParams = options.params
    ? Object.entries(options.params)
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
    throw new OeFetchError(message, response.status, code);
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
