/**
 * Handle lab/pharmacy complete responses including optional e-sign override.
 */

import type { PostDeskActionResult } from './postDeskAction';

export interface CompleteActionHandlers {
  canEsignOverride: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
  onEsignRequired: () => void;
  onUndispensedRx?: (data: { undispensed_count?: number }) => void;
}

export function handleDeskCompleteResult(
  result: PostDeskActionResult<unknown>,
  handlers: CompleteActionHandlers
): void {
  if (result.ok) {
    handlers.onSuccess();
    return;
  }

  const data = result.data as {
    code?: string;
    encounter_url?: string;
    undispensed_count?: number;
  } | undefined;
  if (result.status === 409 && data?.code === 'encounter_unsigned') {
    if (handlers.canEsignOverride) {
      handlers.onEsignRequired();
      return;
    }
    if (data.encounter_url) {
      window.open(data.encounter_url, '_blank', 'noopener,noreferrer');
    }
  }

  if (result.status === 409 && data?.code === 'rx_undispensed') {
    if (handlers.onUndispensedRx) {
      handlers.onUndispensedRx({ undispensed_count: data.undispensed_count });
      return;
    }
  }

  handlers.onError(result.message || 'Complete failed');
}
