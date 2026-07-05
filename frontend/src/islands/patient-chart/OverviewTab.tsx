import { useCallback, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  HeartPulse,
  History,
  LayoutGrid,
  ShieldAlert,
} from 'lucide-react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { cn } from '@/lib/utils';
import {
  ChartEmptyState,
  ChartMetricTile,
  ChartSection,
  ChartStack,
} from './chartUi';
import type {
  ActivityFeedAction,
  ActivityFeedItem,
  ChartActionRequired,
  ChartPreview,
  ChartTabId,
} from './patientChartTypes';
import { completionVariant, formatStateLabel } from './patientChartUtils';

interface OverviewTabProps {
  preview: ChartPreview;
  visitBoardUrl: string;
  activityItems: ActivityFeedItem[];
  activityHasMore: boolean;
  lookbackDays?: number;
  olderHistoryMessage?: string | null;
  loadingMore: boolean;
  onEditProfile: () => void;
  onLoadMoreActivity: () => void;
  onNavigateChartSection: (tab: ChartTabId, anchor?: string) => void;
}

function ActionRequired({ items }: { items: ChartActionRequired[] }) {
  if (!items.length) return null;

  return (
    <ChartSection
      title="Action required"
      description="Items needing attention before this visit can proceed"
      icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
      variant="alert"
    >
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={`${item.title ?? 'action'}-${idx}`}
            className="nc-chart-action-card flex flex-wrap items-start gap-3 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {item.badge && <Badge variant="warning">{item.badge}</Badge>}
                <strong className="text-sm">{item.title ?? 'Action required'}</strong>
              </div>
              {item.message && (
                <div className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">{item.message}</div>
              )}
            </div>
            {item.action_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={item.action_url} target="_top">
                  Open encounter
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                </a>
              </Button>
            )}
          </div>
        ))}
      </div>
    </ChartSection>
  );
}

function renderExpandDetail(item: ActivityFeedItem): React.ReactNode {
  const expand = item.expand ?? {};

  if (item.event_type === 'vitals_saved' && expand.summary) {
    return <div className="text-sm">{expand.summary}</div>;
  }

  if (item.event_type === 'lab_result_ready' && expand.procedure_name) {
    return (
      <div className="text-sm text-[var(--oe-nc-text-muted)]">
        {expand.procedure_name}
        {item.queue_number ? ` · Queue #${item.queue_number}` : ''}
      </div>
    );
  }

  if (item.event_type === 'pharmacy_dispensed' && expand.drug_name) {
    return (
      <div className="text-sm text-[var(--oe-nc-text-muted)]">
        {expand.drug_name}
        {item.queue_number ? ` · Queue #${item.queue_number}` : ''}
      </div>
    );
  }

  if (expand.to_state || expand.from_state) {
    return (
      <div className="text-sm text-[var(--oe-nc-text-muted)]">
        Queue #{item.queue_number ?? '—'}
        {expand.from_state ? ` · ${formatStateLabel(String(expand.from_state))}` : ''}
        {expand.to_state ? ` → ${formatStateLabel(String(expand.to_state))}` : ''}
        {expand.reason ? ` · ${expand.reason}` : ''}
      </div>
    );
  }

  if (expand.procedure_name) {
    return <div className="text-sm text-[var(--oe-nc-text-muted)]">{expand.procedure_name}</div>;
  }

  if (expand.drug_name) {
    return <div className="text-sm text-[var(--oe-nc-text-muted)]">{expand.drug_name}</div>;
  }

  if (item.event_type === 'encounter_document_saved') {
    return (
      <div className="text-sm text-[var(--oe-nc-text-muted)]">
        {expand.form_title ?? 'Clinical form'}
        {expand.author ? ` · ${expand.author}` : ''}
        {expand.saved_at ? ` · ${expand.saved_at}` : ''}
      </div>
    );
  }

  if (item.event_type === 'completion_override' || item.event_type === 'esign_override') {
    return (
      <div className="text-sm text-[var(--oe-nc-text-muted)]">
        {expand.chokepoint ? `Chokepoint: ${expand.chokepoint.replace(/_/g, ' ')}` : null}
        {expand.score ? ` · Score ${expand.score}%` : null}
        {expand.reason ? ` · ${expand.reason}` : ' · Reason not recorded'}
        {expand.actor ? ` · ${expand.actor}` : ''}
      </div>
    );
  }

  return null;
}

function ActivityFeedItemRow({
  item,
  visitBoardUrl,
  expanded,
  onToggleExpand,
  onNavigateChartSection,
}: {
  item: ActivityFeedItem;
  visitBoardUrl: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onNavigateChartSection: (tab: ChartTabId, anchor?: string) => void;
}) {
  const handleAction = useCallback(
    (action?: ActivityFeedAction) => {
      if (!action?.kind) {
        return;
      }

      switch (action.kind) {
        case 'expand':
          onToggleExpand();
          break;
        case 'tab':
          if (action.target?.startsWith('clinical-')) {
            onNavigateChartSection('clinical', action.target);
          } else if (action.target === 'profile-payments') {
            onNavigateChartSection('profile', 'profile-payments');
          } else if (action.target === 'profile') {
            onNavigateChartSection('profile');
          }
          break;
        case 'core':
          if (action.target) {
            window.location.assign(action.target);
          }
          break;
        case 'board':
          if (visitBoardUrl) {
            window.location.assign(visitBoardUrl);
          }
          break;
        default:
          break;
      }
    },
    [onNavigateChartSection, onToggleExpand, visitBoardUrl],
  );

  const primary = item.primary_action;
  const secondary = item.secondary_action;
  const detail = renderExpandDetail(item);
  const showInline = expanded || (primary?.kind === 'expand' && detail);

  return (
    <article
      className={cn(
        'nc-chart-feed-item nc-activity-feed-item',
        expanded && 'nc-chart-feed-item--expanded',
      )}
      data-event-type={item.event_type ?? ''}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <strong className="text-sm text-[var(--oe-nc-text)]">{item.title ?? '—'}</strong>
          {item.subtitle && (
            <div className="mt-0.5 text-sm text-[var(--oe-nc-text-muted)]">{item.subtitle}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {primary?.label && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => handleAction(primary)}
            >
              {primary.label}
            </Button>
          )}
          {secondary?.label && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              onClick={() => handleAction(secondary)}
            >
              {secondary.label}
            </Button>
          )}
        </div>
      </div>
      {detail && (
        <div
          className={cn(
            'nc-chart-feed-item__detail',
            showInline && 'nc-chart-feed-item__detail--open',
          )}
        >
          <div className="nc-chart-feed-item__detail-inner">
            {showInline && (
              <div className="nc-chart-feed-item__detail-content">{detail}</div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function CompletionPill({ score, threshold }: { score: number; threshold: number }) {
  const variant = completionVariant(score, threshold);
  const badgeVariant = variant === 'success' ? 'success' : variant === 'warn' ? 'warning' : 'danger';
  return <Badge variant={badgeVariant}>{score}% profile complete</Badge>;
}

export function OverviewTab({
  preview,
  visitBoardUrl,
  activityItems,
  activityHasMore,
  lookbackDays = 90,
  olderHistoryMessage = null,
  loadingMore,
  onEditProfile,
  onLoadMoreActivity,
  onNavigateChartSection,
}: OverviewTabProps) {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const active = preview.active_visit;
  const last = preview.last_visit ?? {};
  const safety = preview.safety ?? {};
  const completion = preview.completion;
  const vitals = preview.vitals_today ?? {};

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <ChartStack>
      {preview.pediatric_dob_block && (
        <div className={deskCalloutClass('warn', 'py-2')}>
          Estimated DOB — verify for patients under 5.
        </div>
      )}

      {active?.visit_id ? (
        <ChartSection
          title="Today's visit"
          description="Active queue status and chief complaint"
          icon={<LayoutGrid className="h-4 w-4" aria-hidden />}
          variant="accent"
          action={
            visitBoardUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={visitBoardUrl}>
                  Open visit board
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                </a>
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ChartMetricTile
              label="Queue"
              value={`#${active.queue_number}`}
              hint={formatStateLabel(active.state ?? '')}
            />
            {active.chief_complaint && (
              <ChartMetricTile
                label="Chief complaint"
                value={active.chief_complaint}
              />
            )}
          </div>
        </ChartSection>
      ) : (
        <ChartEmptyState
          title="No active visit today."
          description="Start a visit from Front Desk or the Visit Board when the patient arrives."
        />
      )}

      <ActionRequired items={preview.action_required ?? []} />

      <ChartSection
        title="Vitals today"
        icon={<HeartPulse className="h-4 w-4" aria-hidden />}
        bodyClassName={vitals.summary ? undefined : 'py-2'}
      >
        {vitals.summary ? (
          <>
            <p className="mb-0 text-sm font-medium text-[var(--oe-nc-text)]">{vitals.summary}</p>
            {vitals.pain_score !== null &&
              vitals.pain_score !== undefined &&
              vitals.pain_score !== '' && (
                <p className="mb-0 mt-1 text-sm text-[var(--oe-nc-text-muted)]">
                  Pain score {vitals.pain_score}
                </p>
              )}
            {vitals.vitals_abnormal_today && (vitals.vitals_breach_list ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(vitals.vitals_breach_list ?? []).map((w) => (
                  <Badge key={w} variant="danger">
                    {w}
                  </Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <ChartEmptyState
            title="No vitals recorded today"
            description="Record vitals from Triage or the clinical encounter."
          />
        )}
      </ChartSection>

      <ChartSection
        title="Recent activity"
        description={`Timeline from the last ${lookbackDays} days`}
        icon={<Activity className="h-4 w-4" aria-hidden />}
        bodyClassName="pt-2"
      >
        {activityItems.length === 0 ? (
          <ChartEmptyState title="No recent visit activity" />
        ) : (
          <div id="nc-chart-activity-feed-list" className="nc-chart-feed-list">
            {activityItems.map((item, idx) => {
              const rowKey = item.event_id ?? `${item.event_type ?? 'evt'}-${idx}`;
              return (
                <ActivityFeedItemRow
                  key={rowKey}
                  item={item}
                  visitBoardUrl={visitBoardUrl}
                  expanded={!!expandedKeys[rowKey]}
                  onToggleExpand={() => toggleExpanded(rowKey)}
                  onNavigateChartSection={onNavigateChartSection}
                />
              );
            })}
          </div>
        )}
        {activityHasMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 cursor-pointer"
            disabled={loadingMore}
            onClick={onLoadMoreActivity}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        )}
        {!activityHasMore && olderHistoryMessage && (
          <p className="mb-0 mt-3 text-sm text-[var(--oe-nc-text-muted)]">{olderHistoryMessage}</p>
        )}
      </ChartSection>

      {last.label && (
        <ChartSection
          title="Last visit"
          icon={<History className="h-4 w-4" aria-hidden />}
          variant="muted"
          bodyClassName="py-3"
        >
          <p className="mb-0 text-sm">{last.label}</p>
        </ChartSection>
      )}

      {(safety.allergies_undocumented || (safety.allergies_severe ?? []).length > 0) && (
        <ChartSection
          title="Safety"
          icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
          variant="alert"
        >
          <div className="flex flex-wrap gap-1">
            {safety.allergies_undocumented && (
              <Badge variant="warning">Allergies undocumented</Badge>
            )}
            {(safety.allergies_severe ?? []).map((title) => (
              <Badge key={title} variant="danger">
                {title}
              </Badge>
            ))}
          </div>
          {!!safety.problem_count && (
            <p className="mb-0 mt-2 text-sm text-[var(--oe-nc-text-muted)]">
              Active problems: {safety.problem_count}
            </p>
          )}
        </ChartSection>
      )}

      <ChartSection title="Profile readiness" variant="muted">
        {(completion.missing_labels ?? []).length > 0 && (
          <p className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">
            Missing for billing: {(completion.missing_labels ?? []).slice(0, 3).join(', ')}
            {(completion.missing_labels ?? []).length > 3 ? '…' : ''}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <CompletionPill score={completion.score} threshold={completion.billing_threshold} />
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto cursor-pointer p-0"
            onClick={onEditProfile}
          >
            Edit profile
            <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
          </Button>
        </div>
      </ChartSection>
    </ChartStack>
  );
}
