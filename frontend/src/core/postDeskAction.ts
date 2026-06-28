/**
 * POST helper preserving error payload data (e.g. encounter_unsigned on pay/complete).
 *
 * oeFetch throws on success:false and drops the data envelope; this helper preserves it.
 */

import { withCsrfBody, type OeEnvelope } from './oeFetch';

export interface PostDeskActionOptions {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  action: string;
  body: Record<string, unknown>;
}

export type PostDeskActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; data?: unknown };

export async function postDeskAction<T>(
  opts: PostDeskActionOptions
): Promise<PostDeskActionResult<T>> {
  const facilitySuffix =
    opts.facilityId > 0 ? `&facility_id=${encodeURIComponent(String(opts.facilityId))}` : '';
  const url = `${opts.ajaxUrl}?action=${encodeURIComponent(opts.action)}${facilitySuffix}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': opts.csrfToken,
    },
    credentials: 'same-origin',
    body: JSON.stringify(withCsrfBody(opts.body, opts.csrfToken, 'POST')),
  });

  let envelope: OeEnvelope<T>;
  try {
    envelope = (await response.json()) as OeEnvelope<T>;
  } catch {
    return { ok: false, status: response.status, message: 'Invalid server response' };
  }

  if (!envelope.success) {
    return {
      ok: false,
      status: response.status,
      message: envelope.message || 'Request failed',
      data: envelope.data,
    };
  }

  return { ok: true, data: envelope.data };
}
