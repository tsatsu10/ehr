import { describe, expect, it } from 'vitest';
import {
  alertLevelFromMinutes,
  isFlowBoardUnchanged,
  moveCardBetweenLanes,
  sortLanesByOrder,
  tickFlowBoardWaitTimes,
} from './schedulingFlowBoardUtils';
import type { FlowBoardLane } from './schedulingTypes';

const lanes: FlowBoardLane[] = [
  {
    status: '-',
    label: 'None',
    count: 1,
    cards: [{
      pc_eid: 1,
      pid: 10,
      pubpid: 'A1',
      patient_name: 'Pat One',
      appt_time_label: '09:00',
      category_label: 'Visit',
      status: '-',
      status_label: 'None',
      room: '',
      status_since: null,
      minutes_in_status: 0,
      alert_minutes: 30,
      alert_level: 'ok',
      is_recurring: false,
      has_tracker: false,
      next_status: '@',
      check_in_status: '@',
      queue_bridge_ex01: false,
      queue_bridge_fix_url: null,
    }],
  },
  {
    status: '@',
    label: 'Arrived',
    count: 0,
    cards: [],
  },
];

describe('schedulingFlowBoardUtils', () => {
  it('moves a card into the target lane', () => {
    const next = moveCardBetweenLanes(lanes, 1, '@');
    expect(next[0].cards).toHaveLength(0);
    expect(next[0].count).toBe(0);
    expect(next[1].cards).toHaveLength(1);
    expect(next[1].cards[0].status).toBe('@');
  });

  it('returns unchanged lanes when card is missing', () => {
    expect(moveCardBetweenLanes(lanes, 999, '@')).toEqual(lanes);
  });

  it('ticks wait times from status_since', () => {
    const past = new Date(Date.now() - 5 * 60_000).toISOString();
    const next = tickFlowBoardWaitTimes([{
      ...lanes[0],
      cards: [{ ...lanes[0].cards[0], status_since: past, minutes_in_status: 0 }],
    }]);
    expect(next[0].cards[0].minutes_in_status).toBeGreaterThanOrEqual(4);
    expect(alertLevelFromMinutes(30, 20)).toBe('over');
  });

  it('sorts lanes by saved order', () => {
    const lanes = [
      { status: 'a', label: 'A', count: 0, cards: [] },
      { status: 'b', label: 'B', count: 0, cards: [] },
    ];
    const sorted = sortLanesByOrder(lanes, ['b', 'a']);
    expect(sorted.map((lane) => lane.status)).toEqual(['b', 'a']);
  });

  it('detects unchanged poll payloads', () => {
    expect(isFlowBoardUnchanged({
      unchanged: true,
      revision: 'abc',
      poll_interval_ms: 20000,
    })).toBe(true);
    expect(isFlowBoardUnchanged({ revision: 'abc' })).toBe(false);
  });
});
