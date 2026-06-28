import { OeFetchError } from './oeFetch';

export type DeskConflictType =
  | 'stale_visit'
  | 'taken_elsewhere'
  | 'visit_not_takeable'
  | 'generic';

export interface DeskInterrupt {
  type: DeskConflictType;
  message: string;
}

const CODE_TO_TYPE: Partial<Record<string, DeskConflictType>> = {
  stale_visit: 'stale_visit',
  visit_not_takeable: 'visit_not_takeable',
};

const NON_INTERRUPT_CODES = new Set(['encounter_unsigned', 'csrf', 'session_mismatch']);

export function getApiErrorCode(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('code' in data)) {
    return undefined;
  }
  const code = (data as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export function isSessionMismatchCode(code: string | undefined): boolean {
  return code === 'session_mismatch';
}

function classifyByMessage(message: string): DeskConflictType | null {
  const msg = message.toLowerCase();

  if (msg.includes('stale') || msg.includes('updated elsewhere')) {
    return 'stale_visit';
  }

  if (
    msg.includes('taken') ||
    msg.includes('another provider') ||
    msg.includes('assigned to another') ||
    msg.includes('another nurse')
  ) {
    return 'taken_elsewhere';
  }

  if (msg.includes('not takeable') || msg.includes('not available') || msg.includes('complete or release')) {
    return 'visit_not_takeable';
  }

  if (msg.includes('not ready')) {
    return 'visit_not_takeable';
  }

  return null;
}

/**
 * Map API errors to desk interrupt banners (mirrors legacy handleApiFailure paths).
 */
export function resolveDeskConflict(err: OeFetchError): DeskInterrupt | null {
  if (NON_INTERRUPT_CODES.has(err.code)) {
    return null;
  }

  const fromCode = CODE_TO_TYPE[err.code];
  if (fromCode) {
    return {
      type: fromCode,
      message:
        err.message ||
        (fromCode === 'stale_visit'
          ? 'Another user updated this visit first. Refresh the queue and try again.'
          : err.message),
    };
  }

  const fromMessage = classifyByMessage(err.message);
  if (fromMessage) {
    return {
      type: fromMessage,
      message:
        err.message ||
        (fromMessage === 'stale_visit'
          ? 'Another user updated this visit first. Refresh the queue and try again.'
          : err.message),
    };
  }

  if (err.code === 'api_error' && err.status === 409) {
    return { type: 'generic', message: err.message };
  }

  return null;
}

/** Classify postDeskAction failures; session mismatch triggers shared-device re-probe. */
export function applyPostDeskConflict(
  result: { status: number; message: string; data?: unknown },
  handlers: {
    onInterrupt: (interrupt: DeskInterrupt) => void;
    onSessionMismatch?: () => void;
    onInlineError: (message: string) => void;
  },
): boolean {
  const code = getApiErrorCode(result.data) ?? 'api_error';

  if (isSessionMismatchCode(code)) {
    handlers.onSessionMismatch?.();
    handlers.onInlineError(result.message || 'Browser session is on another patient.');
    return true;
  }

  if (NON_INTERRUPT_CODES.has(code)) {
    return false;
  }

  const conflict = resolveDeskConflict(new OeFetchError(result.message, result.status, code));
  if (conflict) {
    handlers.onInterrupt(conflict);
    return true;
  }

  return false;
}

/** Classify oeFetch failures; session mismatch triggers shared-device re-probe. */
export function resolveActionConflict(
  err: unknown,
  options?: { onSessionMismatch?: () => void },
): DeskInterrupt | null {
  if (!(err instanceof OeFetchError)) {
    return null;
  }

  if (isSessionMismatchCode(err.code)) {
    options?.onSessionMismatch?.();
    return null;
  }

  return resolveDeskConflict(err);
}
