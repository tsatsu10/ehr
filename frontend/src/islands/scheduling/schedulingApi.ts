import { oeFetch } from '@core/oeFetch';
import type {
  CalendarDayPayload,
  CalendarPollResult,
  CalendarView,
  FlowBoardPayload,
  FlowBoardPollResult,
  RecallBucket,
  RecallsWorklistPayload,
  SchedulingFilters,
} from './schedulingTypes';

export async function fetchFlowBoard(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
): Promise<FlowBoardPayload> {
  return oeFetch<FlowBoardPayload>('scheduling.flow_board.list', {
    ajaxUrl,
    csrfToken,
    params: {
      date: filters.date,
      facility_id: filters.facilityId,
      provider_id: filters.providerId > 0 ? filters.providerId : undefined,
    },
  });
}

export async function pollFlowBoard(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  revision: string,
): Promise<FlowBoardPollResult> {
  return oeFetch<FlowBoardPollResult>('scheduling.flow_board.poll', {
    ajaxUrl,
    csrfToken,
    params: {
      date: filters.date,
      facility_id: filters.facilityId,
      provider_id: filters.providerId > 0 ? filters.providerId : undefined,
      revision,
    },
  });
}

export async function fetchFlowBoardPrefs(
  ajaxUrl: string,
  csrfToken: string,
): Promise<{ collapsed: string[]; order: string[] }> {
  return oeFetch<{ collapsed: string[]; order: string[] }>('scheduling.flow_board.prefs', {
    ajaxUrl,
    csrfToken,
  });
}

export async function saveFlowBoardPrefs(
  ajaxUrl: string,
  csrfToken: string,
  collapsed: string[],
  order: string[],
): Promise<{ collapsed: string[]; order: string[] }> {
  return oeFetch<{ collapsed: string[]; order: string[] }>('scheduling.flow_board.prefs.save', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: { collapsed, order },
  });
}

export async function advanceFlowBoardStatus(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  pcEid: number,
  status: string,
): Promise<FlowBoardPayload> {
  return oeFetch<FlowBoardPayload>('scheduling.flow_board.advance', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: {
      pc_eid: pcEid,
      status,
      date: filters.date,
      facility_id: filters.facilityId,
      provider_id: filters.providerId > 0 ? filters.providerId : null,
    },
  });
}

export async function updateFlowBoardRoom(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  pcEid: number,
  room: string,
): Promise<FlowBoardPayload> {
  return oeFetch<FlowBoardPayload>('scheduling.flow_board.room', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: {
      pc_eid: pcEid,
      room,
      date: filters.date,
      facility_id: filters.facilityId,
      provider_id: filters.providerId > 0 ? filters.providerId : null,
    },
  });
}

export async function fetchCalendarDay(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
): Promise<CalendarDayPayload> {
  return fetchCalendarRange(ajaxUrl, csrfToken, filters, 'day');
}

export async function fetchCalendarRange(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  view: CalendarView,
): Promise<CalendarDayPayload> {
  return oeFetch<CalendarDayPayload>('scheduling.calendar.range', {
    ajaxUrl,
    csrfToken,
    params: {
      date: filters.date,
      view,
      facility_id: filters.facilityId,
      provider_id: filters.providerId > 0 ? filters.providerId : undefined,
    },
  });
}

export async function pollCalendarRange(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  view: CalendarView,
  revision: string,
): Promise<CalendarPollResult> {
  return oeFetch<CalendarPollResult>('scheduling.calendar.poll', {
    ajaxUrl,
    csrfToken,
    params: {
      date: filters.date,
      view,
      facility_id: filters.facilityId,
      provider_id: filters.providerId > 0 ? filters.providerId : undefined,
      revision,
    },
  });
}

export async function moveCalendarAppointment(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  view: CalendarView,
  body: {
    pc_eid: number;
    date: string;
    time: string;
    provider_id?: number;
    notify_patient?: boolean;
    occurrence_date?: string;
    recurr_scope?: 'current' | 'future' | 'all';
  },
): Promise<CalendarDayPayload> {
  return oeFetch<CalendarDayPayload>('scheduling.calendar.move', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: {
      ...body,
      view,
      anchor_date: filters.date,
      facility_id: filters.facilityId,
      filter_provider_id: filters.providerId > 0 ? filters.providerId : null,
    },
  });
}

export async function resizeCalendarAppointment(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  view: CalendarView,
  pcEid: number,
  durationMinutes: number,
  notifyPatient = false,
  recurring?: { occurrence_date: string; recurr_scope: 'current' | 'future' | 'all' },
): Promise<CalendarDayPayload> {
  return oeFetch<CalendarDayPayload>('scheduling.calendar.resize', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: {
      pc_eid: pcEid,
      duration_minutes: durationMinutes,
      notify_patient: notifyPatient,
      occurrence_date: recurring?.occurrence_date,
      recurr_scope: recurring?.recurr_scope,
      view,
      anchor_date: filters.date,
      facility_id: filters.facilityId,
      filter_provider_id: filters.providerId > 0 ? filters.providerId : null,
    },
  });
}

export async function bookCalendarAppointment(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  body: {
    pid: number;
    provider_id: number;
    pc_catid: number;
    date: string;
    time: string;
    duration_minutes: number;
    comments?: string;
    recall_id?: number;
  },
): Promise<CalendarDayPayload> {
  return oeFetch<CalendarDayPayload>('scheduling.calendar.book', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: {
      ...body,
      facility_id: filters.facilityId,
      recall_id: body.recall_id,
    },
  });
}

export async function fetchRecallsWorklist(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  bucket: RecallBucket,
  search = '',
  pid?: number,
): Promise<RecallsWorklistPayload> {
  return oeFetch<RecallsWorklistPayload>('scheduling.recalls.list', {
    ajaxUrl,
    csrfToken,
    params: {
      facility_id: filters.facilityId,
      provider_id: filters.providerId > 0 ? filters.providerId : undefined,
      bucket,
      q: search || undefined,
      pid: pid && pid > 0 ? pid : undefined,
    },
  });
}

export async function saveRecall(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  bucket: RecallBucket,
  body: {
    recall_id?: number;
    pid: number;
    due_date: string;
    reason: string;
    provider_id: number;
    facility_id: number;
    recall_type?: string;
  },
): Promise<RecallsWorklistPayload> {
  return oeFetch<RecallsWorklistPayload>('scheduling.recalls.save', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: {
      ...body,
      bucket,
      filter_provider_id: filters.providerId > 0 ? filters.providerId : null,
    },
  });
}

export async function deleteRecall(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  bucket: RecallBucket,
  recallId: number,
): Promise<RecallsWorklistPayload> {
  return oeFetch<RecallsWorklistPayload>('scheduling.recalls.delete', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: {
      recall_id: recallId,
      bucket,
      provider_id: filters.providerId > 0 ? filters.providerId : null,
    },
  });
}

export async function updateRecallStatus(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  bucket: RecallBucket,
  recallId: number,
  status: string,
  note?: string,
): Promise<RecallsWorklistPayload> {
  const result = await oeFetch<{ worklist: RecallsWorklistPayload }>('scheduling.recalls.update_status', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: {
      recall_id: recallId,
      status,
      note,
      bucket,
      provider_id: filters.providerId > 0 ? filters.providerId : null,
    },
  });
  return result.worklist;
}

export async function snoozeRecall(
  ajaxUrl: string,
  csrfToken: string,
  filters: SchedulingFilters,
  bucket: RecallBucket,
  recallId: number,
  days: number,
  pid?: number,
): Promise<RecallsWorklistPayload> {
  return oeFetch<RecallsWorklistPayload>('scheduling.recalls.snooze', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: {
      recall_id: recallId,
      days,
      bucket,
      provider_id: filters.providerId > 0 ? filters.providerId : null,
      pid: pid && pid > 0 ? pid : undefined,
    },
  });
}

export async function sendRecallReminder(
  ajaxUrl: string,
  csrfToken: string,
  recallId: number,
): Promise<{ recall_id: number; queued: boolean }> {
  return oeFetch<{ recall_id: number; queued: boolean }>('scheduling.recalls.send_reminder', {
    method: 'POST',
    ajaxUrl,
    csrfToken,
    json: { recall_id: recallId },
  });
}
