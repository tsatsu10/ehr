import { useCallback, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
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
    <div className="mb-3">
      <h6 className="mb-2">Action required</h6>
      {items.map((item, idx) => (
        <div
          key={`${item.title ?? 'action'}-${idx}`}
          className="flex flex-wrap items-start border rounded p-2 mb-2 bg-[var(--oe-nc-bg-tint)]"
        >
          <div className="flex-grow">
            {item.badge && <Badge variant="warning" className="mr-2">{item.badge}</Badge>}
            <strong>{item.title ?? 'Action required'}</strong>
            {item.message && <div className="text-sm text-[var(--oe-nc-text-muted)]">{item.message}</div>}
          </div>
          {item.action_url && (
            <Button variant="outline" size="sm" className="ml-2" asChild>
              <a href={item.action_url} target="_top">
                Open encounter
              </a>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function renderExpandDetail(item: ActivityFeedItem): React.ReactNode {
  const expand = item.expand ?? {};

  if (item.event_type === 'vitals_saved' && expand.summary) {
    return <div className="text-sm mt-1">{expand.summary}</div>;
  }

  if (item.event_type === 'lab_result_ready' && expand.procedure_name) {
    return (
      <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
        {expand.procedure_name}
        {item.queue_number ? ` · Queue #${item.queue_number}` : ''}
      </div>
    );
  }

  if (item.event_type === 'pharmacy_dispensed' && expand.drug_name) {
    return (
      <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
        {expand.drug_name}
        {item.queue_number ? ` · Queue #${item.queue_number}` : ''}
      </div>
    );
  }

  if (expand.to_state || expand.from_state) {
    return (
      <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
        Queue #{item.queue_number ?? '—'}
        {expand.from_state ? ` · ${formatStateLabel(String(expand.from_state))}` : ''}
        {expand.to_state ? ` → ${formatStateLabel(String(expand.to_state))}` : ''}
        {expand.reason ? ` · ${expand.reason}` : ''}
      </div>
    );
  }

  if (expand.procedure_name) {
    return <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">{expand.procedure_name}</div>;
  }

  if (expand.drug_name) {
    return <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">{expand.drug_name}</div>;
  }

  if (item.event_type === 'encounter_document_saved') {
    return (
      <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
        {expand.form_title ?? 'Clinical form'}
        {expand.author ? ` · ${expand.author}` : ''}
        {expand.saved_at ? ` · ${expand.saved_at}` : ''}
      </div>
    );
  }

  if (item.event_type === 'completion_override' || item.event_type === 'esign_override') {
    return (
      <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
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
  const showInline = expanded || primary?.kind === 'expand';

  return (
    <div className="border-bottom py-2 nc-activity-feed-item" data-event-type={item.event_type ?? ''}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-grow min-w-0">
          <strong className="text-sm">{item.title ?? '—'}</strong>
          {item.subtitle && <div className="text-sm text-[var(--oe-nc-text-muted)]">{item.subtitle}</div>}
        </div>
        <div className="flex flex-wrap gap-1">
          {primary?.label && (
            <Button
              type="button"
              variant="outline"
              size="sm"
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
              onClick={() => handleAction(secondary)}
            >
              {secondary.label}
            </Button>
          )}
        </div>
      </div>
      {showInline && renderExpandDetail(item)}
    </div>
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
    <>
      {preview.pediatric_dob_block && (
        <div className={deskCalloutClass('warn', 'py-2')}>Estimated DOB — verify for patients under 5.</div>
      )}

      {active?.visit_id ? (
        <div className="border rounded p-3 mb-3 bg-[var(--oe-nc-bg-tint)]">
          <h5 className="mb-2">Today&apos;s visit</h5>
          <div>
            <strong>#{active.queue_number}</strong> · {formatStateLabel(active.state)}
            {visitBoardUrl && (
              <Button variant="outline" size="sm" className="ml-2" asChild>
                <a href={visitBoardUrl}>
                  Open visit board
                </a>
              </Button>
            )}
          </div>
          {active.chief_complaint && (
            <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">CC: {active.chief_complaint}</div>
          )}
        </div>
      ) : (
        <div className="border rounded p-3 mb-3 text-[var(--oe-nc-text-muted)]">No active visit today.</div>
      )}

      <ActionRequired items={preview.action_required ?? []} />

      {vitals.summary ? (
        <div className="border rounded p-3 mb-3">
          <h6 className="mb-2">Vitals today</h6>
          <div>
            {vitals.summary}
            {vitals.pain_score !== null &&
              vitals.pain_score !== undefined &&
              vitals.pain_score !== '' &&
              ` · Pain ${vitals.pain_score}`}
          </div>
          {vitals.vitals_abnormal_today && (vitals.vitals_breach_list ?? []).length > 0 && (
            <div className="mt-2">
              {(vitals.vitals_breach_list ?? []).map((w) => (
                <Badge key={w} variant="danger" className="mr-1">
                  {w}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded p-3 mb-3 text-[var(--oe-nc-text-muted)] text-sm">No vitals recorded today.</div>
      )}

      <div className="mb-3">
        <h6 className="mb-2">
          Recent activity <span className="text-[var(--oe-nc-text-muted)] text-sm">({lookbackDays}d)</span>
        </h6>
        {activityItems.length === 0 ? (
          <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">No recent visit activity.</p>
        ) : (
          <div id="nc-chart-activity-feed-list">
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
            className="mt-2"
            disabled={loadingMore}
            onClick={onLoadMoreActivity}
          >
            Load more
          </Button>
        )}
        {!activityHasMore && olderHistoryMessage && (
          <p className="text-sm text-[var(--oe-nc-text-muted)] mt-2 mb-0">{olderHistoryMessage}</p>
        )}
      </div>

      {last.label && (
        <div className="mb-3">
          <strong>Last visit:</strong> {last.label}
        </div>
      )}

      {(safety.allergies_undocumented || (safety.allergies_severe ?? []).length > 0) && (
        <div className="mb-3">
          <h6 className="mb-2">Safety</h6>
          {safety.allergies_undocumented && (
            <Badge variant="warning" className="mr-1">Allergies undocumented</Badge>
          )}
          {(safety.allergies_severe ?? []).map((title) => (
            <Badge key={title} variant="danger" className="mr-1">
              {title}
            </Badge>
          ))}
        </div>
      )}

      {!!safety.problem_count && (
        <div className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">Active problems: {safety.problem_count}</div>
      )}

      {(completion.missing_labels ?? []).length > 0 && (
        <div className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">
          Missing for billing: {(completion.missing_labels ?? []).slice(0, 3).join(', ')}
          {(completion.missing_labels ?? []).length > 3 ? '…' : ''}
        </div>
      )}

      <div className="flex items-center flex-wrap">
        <CompletionPill score={completion.score} threshold={completion.billing_threshold} />
        <Button type="button" variant="link" size="sm" className="ml-2 h-auto p-0" onClick={onEditProfile}>
          Edit profile
        </Button>
      </div>
    </>
  );
}
