import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { CircleHelp, ArrowRight } from 'lucide-react';
import type { PeopleSubTabId } from './peopleTypes';
import { PEOPLE_SUB_TABS } from './peopleTypes';
import type { GuidedAclTone } from './guidedAclTasks';
import { subTabLabel } from './guidedAclTasks';

// ADM-4: "primary" is the default/most-common task category — the one brand
// accent, not green (green is reserved for done/success state elsewhere).
const TONE_CARD: Record<GuidedAclTone, string> = {
  primary: 'hover:border-[color-mix(in_srgb,var(--oe-nc-primary)_40%,var(--oe-nc-border))]',
  advanced: 'border-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_35%,var(--oe-nc-border))] hover:border-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_55%,var(--oe-nc-border))]',
  help: 'border-[color-mix(in_srgb,var(--color-oe-info,#0891b2)_30%,var(--oe-nc-border))] hover:border-[color-mix(in_srgb,var(--color-oe-info,#0891b2)_50%,var(--oe-nc-border))]',
};

// The icon swatch was hardcoded green for every tone — didn't track TONE_CARD at all.
const TONE_ICON: Record<GuidedAclTone, string> = {
  primary: 'text-[var(--oe-nc-primary)]',
  advanced: 'text-[var(--color-oe-warning,#d97706)]',
  help: 'text-[var(--color-oe-info,#0891b2)]',
};

export interface GuidedActionCard {
  id: string;
  view: string;
  title: string;
  description: string;
  actionLabel: string;
  destinationSub: PeopleSubTabId;
  tone: GuidedAclTone;
  icon: LucideIcon;
}

export function PeopleLayout({
  header,
  subTab,
  onSubTabChange,
  onHelp,
  children,
}: {
  header?: ReactNode;
  subTab: PeopleSubTabId;
  onSubTabChange: (id: PeopleSubTabId) => void;
  onHelp?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="nc-people-layout space-y-4">
      <div className="nc-people-layout__header flex flex-wrap items-center justify-between gap-3">
        <nav className="nc-people-subtabs flex flex-wrap gap-1 rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-1" aria-label="People sections">
          {PEOPLE_SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'nc-people-subtabs__btn rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                subTab === tab.id
                  ? 'bg-[var(--oe-nc-primary)] text-white'
                  : 'text-[var(--oe-nc-text-muted)] hover:bg-[var(--oe-nc-bg-tint,#f8fafc)]',
              )}
              aria-current={subTab === tab.id ? 'page' : undefined}
              onClick={() => onSubTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {header}
          {onHelp && (
            <Button type="button" variant="ghost" size="sm" onClick={onHelp} aria-label="Open help">
              <CircleHelp className="h-4 w-4" aria-hidden />
              <span className="ml-1">Help</span>
            </Button>
          )}
        </div>
      </div>
      <div className="nc-people-layout__body">{children}</div>
    </div>
  );
}

export function PeopleActionHub({
  actions,
  onOpen,
}: {
  actions: GuidedActionCard[];
  onOpen: (view: string, destinationSub: PeopleSubTabId) => void;
}) {
  return (
    <div className="nc-people-action-hub grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        const leavesAccess = action.destinationSub !== 'access';
        return (
          <article
            key={action.id}
            className={cn(
              'nc-people-action-card group flex cursor-pointer flex-col rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-4 shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))] transition-colors duration-200',
              TONE_CARD[action.tone],
            )}
            onClick={() => onOpen(action.view, action.destinationSub)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(action.view, action.destinationSub);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`${action.title}. ${action.actionLabel}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={cn('inline-flex rounded-lg bg-[var(--oe-nc-bg-tint,#f8fafc)] p-2', TONE_ICON[action.tone])}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              {leavesAccess && (
                <Badge variant="neutral" className="shrink-0 text-xs">
                  {subTabLabel(action.destinationSub)} tab
                </Badge>
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-[var(--oe-nc-text)]">{action.title}</h3>
            <p className="mt-1 flex-1 text-sm text-[var(--oe-nc-text-muted)]">{action.description}</p>
            <Button
              type="button"
              variant={action.tone === 'advanced' ? 'outline' : 'default'}
              size="sm"
              className="mt-3 w-full justify-between transition-colors duration-200 group-hover:shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(action.view, action.destinationSub);
              }}
            >
              <span>{action.actionLabel}</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </article>
        );
      })}
    </div>
  );
}

export function PeoplePanel({
  title,
  description,
  children,
  callout,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  callout?: ReactNode;
}) {
  return (
    <section className="nc-people-panel space-y-3">
      <header>
        <h2 className="text-base font-semibold text-[var(--oe-nc-text)]">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">{description}</p>
        )}
      </header>
      {callout}
      {children}
    </section>
  );
}

export function PeopleWarningCallout({ children }: { children: ReactNode }) {
  return (
    <p className={deskCalloutClass('warn', 'text-sm')}>{children}</p>
  );
}

export function PeopleInfoCallout({ children }: { children: ReactNode }) {
  return (
    <p className={deskCalloutClass('info', 'text-sm')}>{children}</p>
  );
}
