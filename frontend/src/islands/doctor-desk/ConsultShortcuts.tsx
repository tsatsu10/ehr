/**
 * ConsultShortcuts — clinical shortcut buttons (encounter, lab, Rx, chart).
 */

import type { ShortcutKind } from './doctorShortcutNav';

export type { ShortcutKind };

interface ConsultShortcutsProps {
  blocked: boolean;
  clinicalDocHubEnabled?: boolean;
  onOpenDocFavorites?: () => void;
  labPanelOrderEnabled?: boolean;
  formularyRxEnabled?: boolean;
  onOpenLabPanel?: () => void;
  onOpenFormularyRx?: () => void;
  runShortcut: (shortcut: ShortcutKind) => void | Promise<void>;
}

export function ConsultShortcuts({
  blocked,
  clinicalDocHubEnabled = false,
  onOpenDocFavorites,
  labPanelOrderEnabled = false,
  formularyRxEnabled = false,
  onOpenLabPanel,
  onOpenFormularyRx,
  runShortcut,
}: ConsultShortcutsProps) {
  const handleShortcut = (shortcut: ShortcutKind) => {
    if (blocked) {
      return;
    }
    void runShortcut(shortcut);
  };

  return (
    <div className="nc-doctor-shortcuts mb-3">
      <h5 className="mb-2">Consult shortcuts</h5>
      <div className="d-flex flex-wrap">
        <button
          type="button"
          className="btn btn-outline-primary mr-2 mb-2 nc-shortcut-btn"
          data-shortcut="encounter"
          disabled={blocked}
          onClick={() => handleShortcut('encounter')}
        >
          Open encounter
        </button>
        {clinicalDocHubEnabled && (
          <>
            <button
              type="button"
              className="btn btn-primary mr-2 mb-2 nc-shortcut-btn"
              data-shortcut="encounter_hub"
              disabled={blocked}
              onClick={() => handleShortcut('encounter_hub')}
            >
              Open documentation
            </button>
            {onOpenDocFavorites && (
              <button
                type="button"
                className="btn btn-outline-primary mr-2 mb-2 nc-shortcut-btn"
                data-shortcut="doc-favorites"
                disabled={blocked}
                onClick={onOpenDocFavorites}
              >
                Quick forms
              </button>
            )}
          </>
        )}
        <button
          type="button"
          className="btn btn-outline-primary mr-2 mb-2 nc-shortcut-btn"
          data-shortcut="lab"
          disabled={blocked}
          onClick={() => {
            if (labPanelOrderEnabled && onOpenLabPanel) {
              onOpenLabPanel();
            } else {
              handleShortcut('lab');
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
            onClick={() => handleShortcut('lab')}
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
              handleShortcut('rx');
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
            onClick={() => handleShortcut('rx')}
          >
            Full Rx form
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline-secondary mr-2 mb-2 nc-shortcut-btn"
          data-shortcut="chart"
          disabled={blocked}
          onClick={() => handleShortcut('chart')}
        >
          Open full chart ↗
        </button>
      </div>
    </div>
  );
}

export { DOCTOR_LEFT_VIA_KEY } from './doctorShortcutNav';
