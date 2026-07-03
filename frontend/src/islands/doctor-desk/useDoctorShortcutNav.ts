import { useCallback, useState } from 'react';
import type { PatientPreview } from '@core/types';
import type { DoctorVisit } from '@core/types';
import {
  doctorShortcutPreflight,
  isAllergiesUndocumentedError,
  navigateDoctorShortcut,
} from './doctorShortcutNav';
import type { ShortcutKind } from './doctorShortcutNav';

interface UseDoctorShortcutNavOptions {
  ajaxUrl: string;
  csrfToken: string;
  canRxAllergyOverride?: boolean;
  preview: PatientPreview | null;
  visit: DoctorVisit | null;
  onError: (message: string) => void;
}

export function useDoctorShortcutNav({
  ajaxUrl,
  csrfToken,
  canRxAllergyOverride = false,
  preview,
  visit,
  onError,
}: UseDoctorShortcutNavOptions) {
  const [rxOverrideOpen, setRxOverrideOpen] = useState(false);
  const [rxOverrideSubmitting, setRxOverrideSubmitting] = useState(false);
  const [rxOverrideError, setRxOverrideError] = useState<string | null>(null);

  const executeShortcut = useCallback(async (
    visitId: number,
    shortcut: ShortcutKind,
    rxUndocumentedAllergyOverrideReason?: string,
  ) => {
    const data = await doctorShortcutPreflight(
      ajaxUrl,
      csrfToken,
      visitId,
      shortcut,
      rxUndocumentedAllergyOverrideReason
        ? { rxUndocumentedAllergyOverrideReason }
        : undefined,
    );
    navigateDoctorShortcut(visitId, shortcut, data.redirect_url);
  }, [ajaxUrl, csrfToken]);

  const runShortcut = useCallback(async (shortcut: ShortcutKind) => {
    if (!visit) {
      return;
    }

    try {
      await executeShortcut(visit.id, shortcut);
    } catch (err) {
      if (
        shortcut === 'rx'
        && canRxAllergyOverride
        && isAllergiesUndocumentedError(err)
      ) {
        setRxOverrideError(null);
        setRxOverrideOpen(true);
        return;
      }
      onError(err instanceof Error ? err.message : 'Shortcut failed');
    }
  }, [canRxAllergyOverride, executeShortcut, onError, visit]);

  const confirmRxOverride = useCallback(async (reason: string) => {
    if (!visit) {
      return;
    }

    setRxOverrideSubmitting(true);
    setRxOverrideError(null);
    try {
      await executeShortcut(visit.id, 'rx', reason);
      setRxOverrideOpen(false);
    } catch (err) {
      setRxOverrideError(err instanceof Error ? err.message : 'Override failed');
    } finally {
      setRxOverrideSubmitting(false);
    }
  }, [executeShortcut, visit]);

  const closeRxOverride = useCallback(() => {
    if (rxOverrideSubmitting) {
      return;
    }
    setRxOverrideOpen(false);
    setRxOverrideError(null);
  }, [rxOverrideSubmitting]);

  return {
    runShortcut,
    rxOverrideOpen,
    rxOverrideSubmitting,
    rxOverrideError,
    confirmRxOverride,
    closeRxOverride,
    rxOverridePreview: preview,
    rxOverrideVisit: visit,
  };
}
