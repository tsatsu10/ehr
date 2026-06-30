/**
 * ConsultShortcuts — clinical shortcut buttons (encounter, lab, Rx, chart).
 */

import { useCallback } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { DoctorVisit } from '@core/types';
import { setDeskActiveVisitId } from '@core/deskSessionStorage';

const STORAGE_KEY = 'doctor_desk_active_visit_id';
export const DOCTOR_LEFT_VIA_KEY = 'doctor_desk_left_via';

export type ShortcutKind = 'encounter' | 'lab' | 'rx' | 'chart';

interface ConsultShortcutsProps {
  visit: DoctorVisit;
  ajaxUrl: string;
  csrfToken: string;
  blocked: boolean;
  labPanelOrderEnabled?: boolean;
  formularyRxEnabled?: boolean;
  onOpenLabPanel?: () => void;
  onOpenFormularyRx?: () => void;
  onError: (message: string) => void;
}

export function ConsultShortcuts({
  visit,
  ajaxUrl,
  csrfToken,
  blocked,
  labPanelOrderEnabled = false,
  formularyRxEnabled = false,
  onOpenLabPanel,
  onOpenFormularyRx,
  onError,
}: ConsultShortcutsProps) {
  const runShortcut = useCallback(async (shortcut: ShortcutKind) => {
    if (blocked) return;

    if (shortcut === 'chart') {
      try {
        const data = await oeFetch<{ redirect_url: string }>('doctor.shortcut_preflight', {
          ajaxUrl,
          csrfToken,
          method: 'POST',
          json: { visit_id: visit.id, shortcut: 'chart' },
        });
        window.open(data.redirect_url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Chart link failed');
      }
      return;
    }

    setDeskActiveVisitId(STORAGE_KEY, visit.id);
    window.sessionStorage.setItem(DOCTOR_LEFT_VIA_KEY, shortcut);

    try {
      const data = await oeFetch<{ redirect_url: string }>('doctor.shortcut_preflight', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visit.id, shortcut },
      });
      window.location.assign(data.redirect_url);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Shortcut failed');
    }
  }, [ajaxUrl, blocked, csrfToken, onError, visit.id]);

  return (
    <div className="nc-doctor-shortcuts mb-3">
      <h5 className="mb-2">Consult shortcuts</h5>
      <div className="d-flex flex-wrap">
        <button
          type="button"
          className="btn btn-outline-primary mr-2 mb-2 nc-shortcut-btn"
          data-shortcut="encounter"
          disabled={blocked}
          onClick={() => void runShortcut('encounter')}
        >
          Open encounter
        </button>
        <button
          type="button"
          className="btn btn-outline-primary mr-2 mb-2 nc-shortcut-btn"
          data-shortcut="lab"
          disabled={blocked}
          onClick={() => {
            if (labPanelOrderEnabled && onOpenLabPanel) {
              onOpenLabPanel();
            } else {
              void runShortcut('lab');
            }
          }}
        >
          {labPanelOrderEnabled ? 'Quick lab order' : 'Order lab'}
        </button>
        {labPanelOrderEnabled && (
          <button
            type="button"
            className="btn btn-outline-secondary mr-2 mb-2 nc-shortcut-btn"
            data-shortcut="lab-full"
            disabled={blocked}
            onClick={() => void runShortcut('lab')}
          >
            Full lab form
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline-primary mr-2 mb-2 nc-shortcut-btn"
          data-shortcut="rx"
          disabled={blocked}
          onClick={() => {
            if (formularyRxEnabled && onOpenFormularyRx) {
              onOpenFormularyRx();
            } else {
              void runShortcut('rx');
            }
          }}
        >
          {formularyRxEnabled ? 'Quick prescribe' : 'Prescribe'}
        </button>
        {formularyRxEnabled && (
          <button
            type="button"
            className="btn btn-outline-secondary mr-2 mb-2 nc-shortcut-btn"
            data-shortcut="rx-full"
            disabled={blocked}
            onClick={() => void runShortcut('rx')}
          >
            Full Rx form
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline-secondary mr-2 mb-2 nc-shortcut-btn"
          data-shortcut="chart"
          disabled={blocked}
          onClick={() => void runShortcut('chart')}
        >
          Open full chart ↗
        </button>
      </div>
    </div>
  );
}
