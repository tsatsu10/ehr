import type { FlowBoardCard, FlowBoardLane } from './schedulingTypes';

export function moveCardBetweenLanes(
  lanes: FlowBoardLane[],
  pcEid: number,
  targetStatus: string,
): FlowBoardLane[] {
  let moved: FlowBoardCard | null = null;
  const stripped = lanes.map((lane) => {
    const cards = lane.cards.filter((card) => {
      if (card.pc_eid === pcEid) {
        moved = { ...card, status: targetStatus };
        return false;
      }
      return true;
    });
    return { ...lane, cards, count: cards.length };
  });

  if (!moved) {
    return lanes;
  }

  return stripped.map((lane) => {
    if (lane.status !== targetStatus) {
      return lane;
    }
    const cards = [...lane.cards, moved as FlowBoardCard];
    return { ...lane, cards, count: cards.length };
  });
}

export function isFlowBoardUnchanged(
  payload: { unchanged?: boolean },
): payload is { unchanged: true; revision: string; poll_interval_ms: number } {
  return payload.unchanged === true;
}

export function alertLevelFromMinutes(
  minutes: number,
  alertMinutes: number,
): FlowBoardCard['alert_level'] {
  if (alertMinutes <= 0 || minutes <= 0) {
    return 'ok';
  }
  if (minutes >= alertMinutes) {
    return 'over';
  }
  if (minutes >= Math.floor(alertMinutes * 0.75)) {
    return 'warn';
  }
  return 'ok';
}

export function minutesSinceStatus(statusSince: string | null | undefined): number {
  if (!statusSince) {
    return 0;
  }
  const ts = Date.parse(statusSince);
  if (Number.isNaN(ts)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - ts) / 60_000));
}

export function tickFlowBoardWaitTimes(lanes: FlowBoardLane[]): FlowBoardLane[] {
  return lanes.map((lane) => ({
    ...lane,
    cards: lane.cards.map((card) => {
      const minutes = minutesSinceStatus(card.status_since);
      return {
        ...card,
        minutes_in_status: minutes,
        alert_level: alertLevelFromMinutes(minutes, card.alert_minutes),
      };
    }),
  }));
}

export interface FlowBoardLanePrefs {
  collapsed: string[];
  order: string[];
}

const LANE_PREFS_KEY = 'nc-flowboard-lane-prefs';

const emptyPrefs = (): FlowBoardLanePrefs => ({ collapsed: [], order: [] });

export function loadFlowBoardLanePrefs(userId: number): FlowBoardLanePrefs {
  if (typeof window === 'undefined' || userId <= 0) {
    return emptyPrefs();
  }
  try {
    const raw = window.localStorage.getItem(`${LANE_PREFS_KEY}:${userId}`);
    if (!raw) {
      return emptyPrefs();
    }
    const parsed = JSON.parse(raw) as FlowBoardLanePrefs;
    return {
      collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed : [],
      order: Array.isArray(parsed.order) ? parsed.order : [],
    };
  } catch {
    return emptyPrefs();
  }
}

export function saveFlowBoardLanePrefs(userId: number, prefs: FlowBoardLanePrefs): void {
  if (typeof window === 'undefined' || userId <= 0) {
    return;
  }
  window.localStorage.setItem(`${LANE_PREFS_KEY}:${userId}`, JSON.stringify(prefs));
}

export function sortLanesByOrder(lanes: FlowBoardLane[], order: string[]): FlowBoardLane[] {
  if (order.length === 0) {
    return lanes;
  }
  const byStatus = new Map(lanes.map((lane) => [lane.status, lane]));
  const sorted: FlowBoardLane[] = [];
  for (const status of order) {
    const lane = byStatus.get(status);
    if (lane) {
      sorted.push(lane);
      byStatus.delete(status);
    }
  }
  for (const lane of lanes) {
    if (byStatus.has(lane.status)) {
      sorted.push(lane);
      byStatus.delete(lane.status);
    }
  }
  return sorted;
}

export function moveLaneInOrder(
  order: string[],
  status: string,
  delta: -1 | 1,
  allStatuses: string[],
): string[] {
  let base = order.length > 0 ? [...order] : [...allStatuses];
  for (const laneStatus of allStatuses) {
    if (!base.includes(laneStatus)) {
      base.push(laneStatus);
    }
  }
  const index = base.indexOf(status);
  if (index < 0) {
    return base;
  }
  const target = index + delta;
  if (target < 0 || target >= base.length) {
    return base;
  }
  const next = [...base];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function reorderLanes(
  order: string[],
  fromStatus: string,
  toStatus: string,
  allStatuses: string[],
): string[] {
  if (fromStatus === '' || fromStatus === toStatus) {
    return order;
  }
  let base = order.length > 0 ? [...order] : [...allStatuses];
  for (const laneStatus of allStatuses) {
    if (!base.includes(laneStatus)) {
      base.push(laneStatus);
    }
  }
  const without = base.filter((laneStatus) => laneStatus !== fromStatus);
  const targetIndex = without.indexOf(toStatus);
  if (targetIndex < 0) {
    return [...without, fromStatus];
  }
  const next = [...without];
  next.splice(targetIndex, 0, fromStatus);
  return next;
}
