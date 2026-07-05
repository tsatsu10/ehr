/**
 * ConsultShortcuts — clinical shortcut buttons (encounter, lab, Rx, chart).
 */

import { Button } from '@components/ui/button';
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
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="nc-shortcut-btn"
          data-shortcut="encounter"
          disabled={blocked}
          onClick={() => handleShortcut('encounter')}
        >
          Open encounter
        </Button>
        {clinicalDocHubEnabled && (
          <>
            <Button
              type="button"
              className="nc-shortcut-btn"
              data-shortcut="encounter_hub"
              disabled={blocked}
              onClick={() => handleShortcut('encounter_hub')}
            >
              Open documentation
            </Button>
            {onOpenDocFavorites && (
              <Button
                type="button"
                variant="outline"
                className="nc-shortcut-btn"
                data-shortcut="doc-favorites"
                disabled={blocked}
                onClick={onOpenDocFavorites}
              >
                Quick forms
              </Button>
            )}
          </>
        )}
        <Button
          type="button"
          variant="outline"
          className="nc-shortcut-btn"
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
        </Button>
        {labPanelOrderEnabled && (
          <Button
            type="button"
            variant="secondary"
            className="nc-shortcut-btn"
            data-shortcut="lab-full"
            disabled={blocked}
            onClick={() => handleShortcut('lab')}
          >
            Full lab form
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="nc-shortcut-btn"
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
        </Button>
        {formularyRxEnabled && (
          <Button
            type="button"
            variant="secondary"
            className="nc-shortcut-btn"
            data-shortcut="rx-full"
            disabled={blocked}
            onClick={() => handleShortcut('rx')}
          >
            Full Rx form
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          className="nc-shortcut-btn"
          data-shortcut="chart"
          disabled={blocked}
          onClick={() => handleShortcut('chart')}
        >
          Open full chart ↗
        </Button>
      </div>
    </div>
  );
}

export { DOCTOR_LEFT_VIA_KEY } from './doctorShortcutNav';
