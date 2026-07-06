/**
 * LabShortcuts — primary lab workflow actions; legacy/core paths under More.
 */

import { ClipboardList, FileText, FlaskConical, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LabDirectIntake } from '@core/types';
import { cn } from '@/lib/utils';

interface LabShortcutsProps {
  blocked: boolean;
  inLab: boolean;
  labOpsEnabled?: boolean;
  labDirectIntake?: LabDirectIntake | null;
  showCoreOrders: boolean;
  onEnterResults: () => void;
  onOpenOrders: () => void;
  onOpenLabIntake?: () => void;
  onCreateLabOrder?: () => void;
}

interface PrimaryActionProps {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  id?: string;
  onClick: () => void;
}

function PrimaryAction({ icon: Icon, label, disabled, id, onClick }: PrimaryActionProps) {
  return (
    <button
      type="button"
      id={id}
      className="nc-lab-shortcut-primary"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="nc-lab-shortcut-primary__icon h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function MoreLink({
  label,
  disabled,
  id,
  onClick,
}: {
  label: string;
  disabled: boolean;
  id?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" id={id} className="nc-lab-shortcut-more__link" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

export function LabShortcuts({
  blocked,
  inLab,
  labOpsEnabled = false,
  labDirectIntake,
  showCoreOrders,
  onEnterResults,
  onOpenOrders,
  onOpenLabIntake,
  onCreateLabOrder,
}: LabShortcutsProps) {
  const disabled = blocked || !inLab;
  const moreLinks: { label: string; id?: string; onClick: () => void }[] = [];

  if (showCoreOrders) {
    moreLinks.push({ label: 'Open orders (core)', id: 'nc-lab-open-orders', onClick: onOpenOrders });
  }
  if (labDirectIntake?.has_referral && labDirectIntake.referral_view_url) {
    moreLinks.push({
      label: 'View referral',
      onClick: () => window.open(labDirectIntake.referral_view_url!, '_blank', 'noopener,noreferrer'),
    });
  }
  if (!labOpsEnabled) {
    moreLinks.push({ label: 'Open results (core)', id: 'nc-lab-open-results', onClick: onEnterResults });
  }

  const primaries: PrimaryActionProps[] = [
    {
      icon: FlaskConical,
      label: labOpsEnabled ? 'Enter results' : 'Results',
      disabled,
      id: labOpsEnabled ? 'nc-lab-enter-results-primary' : 'nc-lab-open-results',
      onClick: onEnterResults,
    },
  ];

  if (labDirectIntake?.enabled && onCreateLabOrder && labDirectIntake.can_create_orders) {
    primaries.push({
      icon: Plus,
      label: 'Create order',
      disabled: blocked || !inLab,
      onClick: onCreateLabOrder,
    });
  }

  if (labDirectIntake?.enabled && onOpenLabIntake) {
    primaries.push({
      icon: FileText,
      label: labDirectIntake.lab_intake_started ? 'Lab intake' : 'Start intake',
      disabled: blocked,
      onClick: onOpenLabIntake,
    });
  }

  if (primaries.length === 1 && showCoreOrders) {
    primaries.push({
      icon: ClipboardList,
      label: 'Orders',
      disabled,
      id: 'nc-lab-open-orders',
      onClick: onOpenOrders,
    });
  }

  return (
    <div className="nc-lab-shortcuts">
      <div className="nc-lab-shortcuts__primary">
        {primaries.map((action) => (
          <PrimaryAction key={action.label} {...action} />
        ))}
      </div>
      {moreLinks.length > 0 && (
        <div className={cn('nc-lab-shortcut-more', blocked && 'nc-lab-shortcut-more--disabled')}>
          <span className="nc-lab-shortcut-more__label">More</span>
          {moreLinks.map((link) => (
            <MoreLink key={link.label} label={link.label} id={link.id} disabled={blocked || !inLab} onClick={link.onClick} />
          ))}
        </div>
      )}
    </div>
  );
}
