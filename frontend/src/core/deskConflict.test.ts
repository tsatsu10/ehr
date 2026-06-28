import { describe, expect, it, vi } from 'vitest';
import { OeFetchError } from './oeFetch';
import {
  applyPostDeskConflict,
  resolveActionConflict,
  resolveDeskConflict,
} from './deskConflict';

describe('resolveDeskConflict', () => {
  it('returns null for non-conflict errors', () => {
    expect(resolveDeskConflict(new OeFetchError('fail', 500, 'http_error'))).toBeNull();
    expect(resolveDeskConflict(new OeFetchError('Invalid CSRF token', 403, 'csrf'))).toBeNull();
    expect(resolveDeskConflict(new OeFetchError('Unsigned', 409, 'encounter_unsigned'))).toBeNull();
    expect(resolveDeskConflict(new OeFetchError('Session changed', 409, 'session_mismatch'))).toBeNull();
  });

  it('classifies stale visit by API code', () => {
    const err = new OeFetchError('Visit was updated elsewhere', 409, 'stale_visit');
    expect(resolveDeskConflict(err)).toEqual({
      type: 'stale_visit',
      message: 'Visit was updated elsewhere',
    });
  });

  it('classifies visit_not_takeable by API code', () => {
    const err = new OeFetchError('Visit is not takeable', 409, 'visit_not_takeable');
    expect(resolveDeskConflict(err)?.type).toBe('visit_not_takeable');
  });

  it('classifies stale visit conflicts by message fallback', () => {
    const err = new OeFetchError('Visit was updated elsewhere', 409, 'api_error');
    expect(resolveDeskConflict(err)).toEqual({
      type: 'stale_visit',
      message: 'Visit was updated elsewhere',
    });
  });

  it('classifies taken elsewhere conflicts', () => {
    const err = new OeFetchError('Visit taken by another nurse', 409, 'validation');
    expect(resolveDeskConflict(err)?.type).toBe('taken_elsewhere');
  });

  it('classifies not takeable conflicts', () => {
    const err = new OeFetchError('Visit is not takeable', 409, 'validation');
    expect(resolveDeskConflict(err)?.type).toBe('visit_not_takeable');
  });

  it('falls back to generic for unknown 409 api errors', () => {
    const err = new OeFetchError('Something unexpected', 409, 'api_error');
    expect(resolveDeskConflict(err)).toEqual({
      type: 'generic',
      message: 'Something unexpected',
    });
  });
});

describe('resolveActionConflict', () => {
  it('re-probes shared device on session mismatch without interrupt banner', () => {
    const onSessionMismatch = vi.fn();
    const err = new OeFetchError('Browser session is on another patient.', 409, 'session_mismatch');

    expect(resolveActionConflict(err, { onSessionMismatch })).toBeNull();
    expect(onSessionMismatch).toHaveBeenCalledOnce();
  });

  it('returns null for non-OeFetchError values', () => {
    expect(resolveActionConflict(new Error('fail'))).toBeNull();
  });
});

describe('applyPostDeskConflict', () => {
  it('handles session mismatch with inline error', () => {
    const onSessionMismatch = vi.fn();
    const onInlineError = vi.fn();
    const onInterrupt = vi.fn();

    const handled = applyPostDeskConflict(
      {
        status: 409,
        message: 'Browser session is on another patient.',
        data: { code: 'session_mismatch' },
      },
      { onInterrupt, onSessionMismatch, onInlineError },
    );

    expect(handled).toBe(true);
    expect(onSessionMismatch).toHaveBeenCalledOnce();
    expect(onInlineError).toHaveBeenCalledWith('Browser session is on another patient.');
    expect(onInterrupt).not.toHaveBeenCalled();
  });

  it('defers encounter_unsigned to caller complete handler', () => {
    const onInlineError = vi.fn();
    const onInterrupt = vi.fn();

    const handled = applyPostDeskConflict(
      {
        status: 409,
        message: 'Encounter must be signed',
        data: { code: 'encounter_unsigned' },
      },
      { onInterrupt, onInlineError },
    );

    expect(handled).toBe(false);
    expect(onInlineError).not.toHaveBeenCalled();
    expect(onInterrupt).not.toHaveBeenCalled();
  });

  it('maps stale visit to interrupt banner', () => {
    const onInterrupt = vi.fn();

    const handled = applyPostDeskConflict(
      {
        status: 409,
        message: 'Visit was updated elsewhere',
        data: { code: 'stale_visit' },
      },
      {
        onInterrupt,
        onInlineError: vi.fn(),
      },
    );

    expect(handled).toBe(true);
    expect(onInterrupt).toHaveBeenCalledWith({
      type: 'stale_visit',
      message: 'Visit was updated elsewhere',
    });
  });
});
