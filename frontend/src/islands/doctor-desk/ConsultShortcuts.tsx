/**
 * ConsultShortcuts — one primary action per workflow; escape hatches as text links.
 *
 * Shown upfront: encounter, lab, Rx, chart (the four things doctors do every visit).
 * Hidden unless needed: doc hub, quick forms, full legacy lab/Rx forms.
 */

import {
  ExternalLink,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface PrimaryActionProps {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  dataShortcut: string;
  onClick: () => void;
  external?: boolean;
}

function PrimaryAction({
  icon: Icon,
  label,
  disabled,
  dataShortcut,
  onClick,
  external,
}: PrimaryActionProps) {
  return (
    <button
      type="button"
      className="nc-doctor-shortcut-primary nc-shortcut-btn"
      data-shortcut={dataShortcut}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="nc-doctor-shortcut-primary__icon h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
      {external && <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />}
    </button>
  );
}

interface MoreLinkProps {
  label: string;
  disabled: boolean;
  dataShortcut?: string;
  onClick: () => void;
}

function MoreLink({ label, disabled, dataShortcut, onClick }: MoreLinkProps) {
  return (
    <button
      type="button"
      className="nc-doctor-shortcut-more__link"
      data-shortcut={dataShortcut}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
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
    if (blocked) return;
    void runShortcut(shortcut);
  };

  const moreLinks: MoreLinkProps[] = [];

  if (clinicalDocHubEnabled) {
    moreLinks.push({
      label: 'Documentation hub',
      disabled: blocked,
      dataShortcut: 'encounter_hub',
      onClick: () => handleShortcut('encounter_hub'),
    });
  }
  if (clinicalDocHubEnabled && onOpenDocFavorites) {
    moreLinks.push({
      label: 'Quick forms',
      disabled: blocked,
      onClick: onOpenDocFavorites,
    });
  }
  if (labPanelOrderEnabled) {
    moreLinks.push({
      label: 'Full lab form',
      disabled: blocked,
      dataShortcut: 'lab-full',
      onClick: () => handleShortcut('lab'),
    });
  }
  if (formularyRxEnabled) {
    moreLinks.push({
      label: 'Full Rx form',
      disabled: blocked,
      dataShortcut: 'rx-full',
      onClick: () => handleShortcut('rx'),
    });
  }

  return (
    <div className="nc-doctor-shortcuts">
      <div className="nc-doctor-shortcuts__primary">
        <PrimaryAction
          icon={Stethoscope}
          label="Encounter"
          disabled={blocked}
          dataShortcut="encounter"
          onClick={() => handleShortcut('encounter')}
        />
        <PrimaryAction
          icon={FlaskConical}
          label={labPanelOrderEnabled ? 'Lab order' : 'Order lab'}
          disabled={blocked}
          dataShortcut="lab"
          onClick={() => {
            if (labPanelOrderEnabled && onOpenLabPanel) {
              onOpenLabPanel();
            } else {
              handleShortcut('lab');
            }
          }}
        />
        <PrimaryAction
          icon={Pill}
          label={formularyRxEnabled ? 'Prescribe' : 'Rx'}
          disabled={blocked}
          dataShortcut="rx"
          onClick={() => {
            if (formularyRxEnabled && onOpenFormularyRx) {
              onOpenFormularyRx();
            } else {
              handleShortcut('rx');
            }
          }}
        />
        <PrimaryAction
          icon={FileText}
          label="Chart"
          disabled={blocked}
          dataShortcut="chart"
          external
          onClick={() => handleShortcut('chart')}
        />
      </div>

      {moreLinks.length > 0 && (
        <div className={cn('nc-doctor-shortcut-more', blocked && 'nc-doctor-shortcut-more--disabled')}>
          <span className="nc-doctor-shortcut-more__label">More</span>
          {moreLinks.map((link) => (
            <MoreLink key={link.label} {...link} />
          ))}
        </div>
      )}
    </div>
  );
}

export { DOCTOR_LEFT_VIA_KEY } from './doctorShortcutNav';
