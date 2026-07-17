import { oeFetch } from '@core/oeFetch';
import type { ChartChatData, ChartChatMessage } from './patientChartTypes';

interface FetchContext {
  ajaxUrl: string;
  csrfToken: string;
}

export function listChat(ctx: FetchContext, pid: number): Promise<ChartChatData> {
  return oeFetch<ChartChatData>('chat.list', {
    ...ctx,
    params: { pid },
  });
}

export function sendChatMessage(
  ctx: FetchContext,
  pid: number,
  body: string,
): Promise<ChartChatMessage> {
  return oeFetch<ChartChatMessage>('chat.send', {
    ...ctx,
    json: { pid, body },
  });
}
