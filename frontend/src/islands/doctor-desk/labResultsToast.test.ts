import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildLabResultsReadyNotice,
  markLabResultsToastSeen,
  scanQueueCardsForLabResultsToast,
  seedResultsReadyState,
  wasLabResultsToastSeen,
} from './labResultsToast';

describe('labResultsToast', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('builds notice on false-to-true transition when enabled', () => {
    const notice = buildLabResultsReadyNotice(42, 'Jane Doe', 7, false, true, true);
    expect(notice?.variant).toBe('success');
    expect(notice?.message).toContain('Jane Doe');
    expect(notice?.message).toContain('#7');
    expect(wasLabResultsToastSeen(42)).toBe(true);
  });

  it('does not repeat toast for the same visit in a session', () => {
    buildLabResultsReadyNotice(42, 'Jane Doe', 7, false, true, true);
    const second = buildLabResultsReadyNotice(42, 'Jane Doe', 7, false, true, true);
    expect(second).toBeNull();
  });

  it('ignores when feature disabled', () => {
    expect(buildLabResultsReadyNotice(42, 'Jane Doe', 7, false, true, false)).toBeNull();
  });

  it('scans queue cards and returns first new ready notice after baseline', () => {
    const baseline = seedResultsReadyState(
      [{ id: 1, display_name: 'A', queue_number: 1, routing_chips: { results_ready: false } }],
      null,
      {},
    );
    const result = scanQueueCardsForLabResultsToast(
      [
        { id: 1, display_name: 'A', queue_number: 1, routing_chips: { results_ready: false } },
        { id: 2, display_name: 'B', queue_number: 2, routing_chips: { results_ready: true } },
      ],
      baseline,
      true,
    );
    expect(result.notice?.message).toContain('B');
    expect(result.nextState[2]).toBe(true);
  });

  it('seeds ready state without creating a notice', () => {
    const seeded = seedResultsReadyState(
      [{ id: 2, display_name: 'B', queue_number: 2, routing_chips: { results_ready: true } }],
      null,
      {},
    );
    expect(seeded[2]).toBe(true);
    const result = scanQueueCardsForLabResultsToast(
      [{ id: 2, display_name: 'B', queue_number: 2, routing_chips: { results_ready: true } }],
      seeded,
      true,
    );
    expect(result.notice).toBeNull();
  });

  it('marks toast seen via helper', () => {
    markLabResultsToastSeen(99);
    expect(wasLabResultsToastSeen(99)).toBe(true);
  });
});
