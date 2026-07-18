import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import { Button } from '@components/ui/button';
import { t } from '@core/i18n';
import type { AdminTabId, SetupProgressItem, SetupProgressPayload } from './adminTypes';
import { ADMIN_TABS } from './adminTypes';
import { AdminSection } from './adminUi';

interface SetupChecklistCardProps {
  progress: SetupProgressPayload;
  markingKey: string | null;
  completing: boolean;
  reopening: boolean;
  onMarkItem: (key: string) => void;
  onUnmarkItem: (key: string) => void;
  onMarkComplete: () => void;
  onReopen: () => void;
  /** "Take me there" navigation for items whose work lives on another tab. */
  onNavigateTab: (tab: AdminTabId) => void;
}

function isAdminTab(value: string | null | undefined): value is AdminTabId {
  return typeof value === 'string' && ADMIN_TABS.some((tab) => tab.id === value);
}

function tabLabel(tabId: AdminTabId): string {
  return ADMIN_TABS.find((tab) => tab.id === tabId)?.label ?? tabId;
}

export function SetupChecklistCard({
  progress,
  markingKey,
  completing,
  reopening,
  onMarkItem,
  onUnmarkItem,
  onMarkComplete,
  onReopen,
  onNavigateTab,
}: SetupChecklistCardProps) {
  const threshold = progress.score_threshold ?? 70;
  const remaining = progress.items.filter((item) => !item.completed);

  if (progress.setup_complete) {
    return (
      <AdminSection
        id="nc-admin-setup-checklist"
        title={t('Setup complete')}
        description={
          remaining.length
            ? t('Marked complete at {pct}% — {count} item(s) still open below.', {
              pct: String(progress.score_percent),
              count: String(remaining.length),
            })
            : t('Every checklist item is finished.')
        }
        icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
        variant="success"
        action={(
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={reopening}
            onClick={onReopen}
          >
            {reopening ? t('Reopening…') : t('Reopen setup')}
          </Button>
        )}
      >
        {remaining.length ? (
          <ul className="m-0 list-none p-0">
            {remaining.map((item) => (
              <SetupChecklistRow
                key={item.key}
                item={item}
                marking={markingKey === item.key}
                onMark={() => onMarkItem(item.key)}
                onUnmark={() => onUnmarkItem(item.key)}
                onNavigateTab={onNavigateTab}
              />
            ))}
          </ul>
        ) : (
          <p className="mb-0 text-sm font-medium text-[var(--color-oe-cta,#047857)]">
            {t('This clinic is ready for day-to-day operations.')}
          </p>
        )}
      </AdminSection>
    );
  }

  return (
    <AdminSection
      id="nc-admin-setup-checklist"
      title={t('Setup checklist')}
      description={t('Get this clinic ready to run — {pct}% done', { pct: String(progress.score_percent) })}
      icon={<ListChecks className="h-4 w-4" aria-hidden />}
      variant="accent"
      action={
        progress.can_mark_complete ? (
          <Button
            type="button"
            size="sm"
            variant="cta"
            disabled={completing}
            onClick={onMarkComplete}
          >
            {completing ? t('Saving…') : t('Mark setup complete')}
          </Button>
        ) : undefined
      }
    >
      <div
        className="nc-admin-progress mb-2"
        role="progressbar"
        aria-label={t('Setup progress')}
        aria-valuenow={progress.score_percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="nc-admin-progress__bar" style={{ width: `${progress.score_percent}%` }} />
      </div>

      {!progress.can_mark_complete && (
        <p className="mb-3 text-xs text-[var(--oe-nc-text-muted)]">
          {t('You can mark setup complete once you reach {threshold}% — currently {pct}%.', {
            threshold: String(threshold),
            pct: String(progress.score_percent),
          })}
        </p>
      )}

      <ul className="m-0 list-none p-0">
        {progress.items.map((item) => (
          <SetupChecklistRow
            key={item.key}
            item={item}
            marking={markingKey === item.key}
            onMark={() => onMarkItem(item.key)}
            onUnmark={() => onUnmarkItem(item.key)}
            onNavigateTab={onNavigateTab}
          />
        ))}
      </ul>
    </AdminSection>
  );
}

function SetupChecklistRow({
  item,
  marking,
  onMark,
  onUnmark,
  onNavigateTab,
}: {
  item: SetupProgressItem;
  marking: boolean;
  onMark: () => void;
  onUnmark: () => void;
  onNavigateTab: (tab: AdminTabId) => void;
}) {
  // The card only renders on the System tab, so a "take me there" link to
  // the System tab itself would be noise — the hint already says "below".
  const linkTab = isAdminTab(item.link_tab) && item.link_tab !== 'system' ? item.link_tab : null;

  return (
    <li className="flex items-start border-b border-[var(--oe-nc-border)]/70 py-2 last:border-b-0">
      {item.completed ? (
        <CheckCircle2 className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[var(--color-oe-cta,#047857)]" aria-hidden />
      ) : (
        <Circle className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[var(--oe-nc-text-muted)]" aria-hidden />
      )}
      <div className="min-w-0 flex-grow">
        <div className="text-sm font-semibold">
          {/* State is announced, not just drawn (the icons are aria-hidden). */}
          <span className="sr-only">{item.completed ? t('Done:') : t('To do:')} </span>
          {item.label}
          <span className="ml-2 text-xs font-normal text-[var(--oe-nc-text-muted)]">
            +{item.weight}%
          </span>
        </div>
        {!item.completed && item.hint && (
          <div className="text-sm text-[var(--oe-nc-text-muted)]">
            {item.hint}
            {linkTab && (
              <>
                {' '}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 align-baseline"
                  onClick={() => onNavigateTab(linkTab)}
                >
                  {t('Open {tab} →', { tab: tabLabel(linkTab) })}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {item.manual && !item.completed && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-2 shrink-0"
          disabled={marking}
          aria-busy={marking}
          aria-label={t('Mark "{item}" done', { item: item.label })}
          onClick={onMark}
        >
          {marking ? t('Saving…') : t('Mark done')}
        </Button>
      )}
      {item.manual && item.completed && item.ticked && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="ml-2 h-auto shrink-0 p-0"
          disabled={marking}
          aria-busy={marking}
          aria-label={t('Untick "{item}"', { item: item.label })}
          onClick={onUnmark}
        >
          {marking ? t('Saving…') : t('Undo')}
        </Button>
      )}
    </li>
  );
}
