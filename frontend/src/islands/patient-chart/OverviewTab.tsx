import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import type { ActivityFeedItem, ChartActionRequired, ChartPreview } from './patientChartTypes';
import { completionVariant, formatStateLabel } from './patientChartUtils';

interface OverviewTabProps {
  preview: ChartPreview;
  visitBoardUrl: string;
  activityItems: ActivityFeedItem[];
  activityHasMore: boolean;
  lookbackDays?: number;
  loadingMore: boolean;
  onEditProfile: () => void;
  onLoadMoreActivity: () => void;
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

function ActivityFeedItemRow({ item }: { item: ActivityFeedItem }) {
  const expand = item.expand ?? {};
  let detail: React.ReactNode = null;

  if (item.event_type === 'lab_result_ready' && expand.procedure_name) {
    detail = (
      <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
        {expand.procedure_name}
        {item.queue_number ? ` · Queue #${item.queue_number}` : ''}
      </div>
    );
  } else if (expand.to_state) {
    detail = (
      <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
        Queue #{item.queue_number ?? '—'}
        {expand.reason ? ` · ${expand.reason}` : ''}
      </div>
    );
  }

  return (
    <div className="border-bottom py-2 nc-activity-feed-item" data-event-type={item.event_type ?? ''}>
      <div className="flex justify-between">
        <strong className="text-sm">{item.title ?? '—'}</strong>
      </div>
      {item.subtitle && <div className="text-sm text-[var(--oe-nc-text-muted)]">{item.subtitle}</div>}
      {detail}
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
  loadingMore,
  onEditProfile,
  onLoadMoreActivity,
}: OverviewTabProps) {
  const active = preview.active_visit;
  const last = preview.last_visit ?? {};
  const safety = preview.safety ?? {};
  const completion = preview.completion;
  const vitals = preview.vitals_today ?? {};

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
            {activityItems.map((item, idx) => (
              <ActivityFeedItemRow key={`${item.event_type ?? 'evt'}-${idx}`} item={item} />
            ))}
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
