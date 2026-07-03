import { oeFetch } from '@core/oeFetch';
import type { QueueBridgeLens, QueueBridgeListPayload } from './queueBridgeTypes';

export async function fetchQueueBridgeList(
  ajaxUrl: string,
  csrfToken: string,
  lens: QueueBridgeLens,
  page = 1,
): Promise<QueueBridgeListPayload> {
  return oeFetch<QueueBridgeListPayload>('queue_bridge.list', {
    ajaxUrl,
    csrfToken,
    params: { lens, page },
  });
}

export async function resolveQueueBridgeException(
  ajaxUrl: string,
  csrfToken: string,
  payload: {
    exception_code: string;
    action: string;
    pid: number;
    pc_eid?: number | null;
    visit_id?: number | null;
    appt_date?: string;
    cancel_reason?: string;
  },
): Promise<{ list?: QueueBridgeListPayload; visit?: Record<string, unknown> }> {
  const actionName = payload.action === 'link_appointment'
    ? 'queue_bridge.link_appointment'
    : 'queue_bridge.resolve';

  return oeFetch(actionName, {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: payload.action === 'link_appointment'
      ? {
          exception_code: payload.exception_code,
          pid: payload.pid,
          pc_eid: payload.pc_eid,
          visit_id: payload.visit_id,
          appt_date: payload.appt_date,
        }
      : payload,
  });
}

export async function dismissQueueBridgeException(
  ajaxUrl: string,
  csrfToken: string,
  payload: {
    exception_code: string;
    pid: number;
    reason: string;
    pc_eid?: number | null;
    visit_id?: number | null;
  },
): Promise<{ list?: QueueBridgeListPayload }> {
  return oeFetch('queue_bridge.dismiss', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: payload,
  });
}
