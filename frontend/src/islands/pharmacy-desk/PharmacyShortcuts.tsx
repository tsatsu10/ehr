/**
 * PharmacyShortcuts — primary dispense workflow; core escape hatches under More.
 */

import { ClipboardList, Pill, Plus, Printer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PharmacyShortcutsProps {
  blocked: boolean;
  inPharmacy: boolean;
  pharmOpsEnabled?: boolean;
  canPrintRx?: boolean;
  rxListUrl?: string;
  showPharmacyService?: boolean;
  pharmacyServiceStarted?: boolean;
  /** At least one prescription with a "to dispense" line exists right now. */
  hasDispensable?: boolean;
  /** At least one prescription exists to print. */
  hasPrintable?: boolean;
  onDispense: () => void;
  onAddRx: () => void;
  onPrintRx?: () => void;
  onOpenPharmacyService?: () => void;
  onOpenDispenseCore: () => void;
}

interface PrimaryActionProps {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  id?: string;
  title?: string;
  onClick: () => void;
}

function PrimaryAction({ icon: Icon, label, disabled, id, title, onClick }: PrimaryActionProps) {
  return (
    <button
      type="button"
      id={id}
      className="nc-pharmacy-shortcut-primary"
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <Icon className="nc-pharmacy-shortcut-primary__icon h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function MoreLink({
  label,
  disabled,
  id,
  href,
  onClick,
}: {
  label: string;
  disabled: boolean;
  id?: string;
  href?: string;
  onClick?: () => void;
}) {
  if (href) {
    return (
      <a
        id={id}
        className={cn('nc-pharmacy-shortcut-more__link', disabled && 'nc-pharmacy-shortcut-more__link--disabled')}
        href={disabled ? undefined : href}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={disabled}
        onClick={(e) => disabled && e.preventDefault()}
      >
        {label}
      </a>
    );
  }

  return (
    <button
      type="button"
      id={id}
      className="nc-pharmacy-shortcut-more__link"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function PharmacyShortcuts({
  blocked,
  inPharmacy,
  pharmOpsEnabled = false,
  canPrintRx = false,
  rxListUrl,
  showPharmacyService = false,
  pharmacyServiceStarted = false,
  hasDispensable = true,
  hasPrintable = true,
  onDispense,
  onAddRx,
  onPrintRx,
  onOpenPharmacyService,
  onOpenDispenseCore,
}: PharmacyShortcutsProps) {
  const disabled = blocked || !inPharmacy;
  const moreLinks: {
    label: string;
    id?: string;
    href?: string;
    onClick?: () => void;
  }[] = [];

  if (rxListUrl) {
    moreLinks.push({ label: 'Open Rx list (core)', id: 'nc-pharmacy-open-rx-list', href: rxListUrl });
  }
  if (pharmOpsEnabled) {
    moreLinks.push({
      label: 'Advanced dispense (core)',
      id: 'nc-pharmacy-open-dispense',
      onClick: onOpenDispenseCore,
    });
  } else {
    moreLinks.push({
      label: 'Encounter / dispense (core)',
      id: 'nc-pharmacy-open-dispense',
      onClick: onOpenDispenseCore,
    });
  }
  if (showPharmacyService && onOpenPharmacyService) {
    moreLinks.push({
      label: pharmacyServiceStarted ? 'Pharmacy service note' : 'Start service note',
      onClick: onOpenPharmacyService,
    });
  }

  return (
    <div className="nc-pharmacy-shortcuts">
      <div className="nc-pharmacy-shortcuts__primary">
        <PrimaryAction
          icon={Pill}
          label="Dispense"
          disabled={disabled || !hasDispensable}
          title={!disabled && !hasDispensable ? 'Nothing to dispense yet — add a prescription first' : undefined}
          id="nc-pharmacy-dispense-primary"
          onClick={onDispense}
        />
        <PrimaryAction
          icon={Plus}
          label="Add Rx"
          disabled={disabled}
          id="nc-pharmacy-open-rx-edit"
          onClick={onAddRx}
        />
        {canPrintRx && onPrintRx && (
          <PrimaryAction
            icon={Printer}
            label="Print Rx"
            disabled={disabled || !hasPrintable}
            title={!disabled && !hasPrintable ? 'No prescriptions to print yet — add one first' : undefined}
            onClick={onPrintRx}
          />
        )}
        {!canPrintRx && (
          <PrimaryAction
            icon={ClipboardList}
            label="Rx list"
            disabled={disabled || !rxListUrl}
            onClick={() => rxListUrl && window.open(rxListUrl, '_blank', 'noopener,noreferrer')}
          />
        )}
      </div>
      {moreLinks.length > 0 && (
        <div className={cn('nc-pharmacy-shortcut-more', blocked && 'nc-pharmacy-shortcut-more--disabled')}>
          <span className="nc-pharmacy-shortcut-more__label">More</span>
          {moreLinks.map((link) => (
            <MoreLink
              key={link.label}
              label={link.label}
              id={link.id}
              href={link.href}
              disabled={blocked || (!inPharmacy && !link.href)}
              onClick={link.onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
