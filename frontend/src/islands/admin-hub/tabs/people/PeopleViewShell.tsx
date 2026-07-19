import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { ChevronLeft } from 'lucide-react';
import type { GuidedAclTone } from '../../guidedAclTasks';
import { subTabLabel } from '../../guidedAclTasks';
import type { PeopleSubTabId } from '../../peopleTypes';

// ADM-4: "primary" is the default task category — the one brand accent, not
// green (matches the same fix in peopleUi.tsx's TONE_CARD/TONE_ICON).
const TONE_STYLES: Record<GuidedAclTone, string> = {
  primary: 'border-l-[var(--oe-nc-primary)]',
  advanced: 'border-l-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_70%,transparent)]',
  help: 'border-l-[color-mix(in_srgb,var(--color-oe-info,#0891b2)_70%,transparent)]',
};

export function PeopleViewShell({
  title,
  description,
  originSub,
  tone = 'primary',
  onBack,
  children,
}: {
  title: string;
  description?: string;
  originSub: PeopleSubTabId;
  tone?: GuidedAclTone;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'nc-people-view space-y-4 rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-4 shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))] border-l-4',
        TONE_STYLES[tone],
      )}
    >
      <header className="space-y-3">
        <nav className="flex flex-wrap items-center gap-2 text-xs text-[var(--oe-nc-text-muted)]" aria-label="Breadcrumb">
          <span>People & access</span>
          <span aria-hidden>/</span>
          <Badge variant="neutral" className="text-xs font-normal">
            {subTabLabel(originSub)}
          </Badge>
          <span aria-hidden>/</span>
          <span className="font-medium text-[var(--oe-nc-text)]">{title}</span>
        </nav>
        <div className="flex flex-wrap items-start gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back to {subTabLabel(originSub)}
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[var(--oe-nc-text)]">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">{description}</p>
            )}
          </div>
        </div>
      </header>
      {children}
    </section>
  );
}
