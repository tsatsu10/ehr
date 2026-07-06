/**
 * CashierShortcuts — core billing escape hatches under More.
 */

import { ExternalLink, FileSpreadsheet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CashierShortcutsProps {
  feeSheetUrl?: string;
  feeSheetLabel?: string;
  feeSheetExternal?: boolean;
  frontPaymentUrl?: string;
}

interface MoreLinkProps {
  icon: LucideIcon;
  label: string;
  href: string;
  external?: boolean;
}

function MoreLink({ icon: Icon, label, href, external = true }: MoreLinkProps) {
  return (
    <a
      className="nc-cashier-shortcut-more__link"
      href={href}
      target={external ? '_blank' : '_top'}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </a>
  );
}

export function CashierShortcuts({
  feeSheetUrl,
  feeSheetLabel,
  feeSheetExternal = true,
  frontPaymentUrl,
}: CashierShortcutsProps) {
  const links: MoreLinkProps[] = [];

  if (feeSheetUrl) {
    links.push({
      icon: FileSpreadsheet,
      label: feeSheetLabel || 'Open fee sheet',
      href: feeSheetUrl,
      external: feeSheetExternal,
    });
  }
  if (frontPaymentUrl) {
    links.push({
      icon: ExternalLink,
      label: 'Open payments (core)',
      href: frontPaymentUrl,
    });
  }

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="nc-cashier-shortcuts">
      <div className="nc-cashier-shortcut-more">
        <span className="nc-cashier-shortcut-more__label">More</span>
        {links.map((link) => (
          <MoreLink key={link.label} {...link} />
        ))}
      </div>
    </div>
  );
}
