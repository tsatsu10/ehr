import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import { Button } from '@components/ui/button';
import type { SetupProgressItem, SetupProgressPayload } from './adminTypes';
import { AdminSection } from './adminUi';

interface SetupChecklistCardProps {
  progress: SetupProgressPayload;
  markingKey: string | null;
  completing: boolean;
  onMarkItem: (key: string) => void;
  onMarkComplete: () => void;
}

export function SetupChecklistCard({
  progress,
  markingKey,
  completing,
  onMarkItem,
  onMarkComplete,
}: SetupChecklistCardProps) {
  if (progress.setup_complete) {
    return (
      <AdminSection
        title="Setup complete"
        description={`All checklist items finished (${progress.score_percent}%)`}
        icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
        variant="success"
      >
        <p className="mb-0 text-sm font-medium text-[var(--color-oe-cta,#047857)]">
          This clinic is ready for day-to-day operations.
        </p>
      </AdminSection>
    );
  }

  return (
    <AdminSection
      id="nc-admin-setup-checklist"
      title="Setup checklist"
      description={`First-run wizard progress — ${progress.score_percent}% complete`}
      icon={<ListChecks className="h-4 w-4" aria-hidden />}
      variant="accent"
      action={
        progress.can_mark_complete ? (
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={completing}
            onClick={onMarkComplete}
          >
            {completing ? 'Saving…' : 'Mark setup complete'}
          </Button>
        ) : undefined
      }
    >
      <div
        className="nc-admin-progress mb-3"
        role="progressbar"
        aria-valuenow={progress.score_percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="nc-admin-progress__bar" style={{ width: `${progress.score_percent}%` }} />
      </div>

      <ul className="m-0 list-none p-0">
        {progress.items.map((item) => (
          <SetupChecklistRow
            key={item.key}
            item={item}
            marking={markingKey === item.key}
            onMark={() => onMarkItem(item.key)}
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
}: {
  item: SetupProgressItem;
  marking: boolean;
  onMark: () => void;
}) {
  return (
    <li className="flex items-start border-b border-[var(--oe-nc-border)]/70 py-2 last:border-b-0">
      {item.completed ? (
        <CheckCircle2 className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[var(--color-oe-cta,#047857)]" aria-hidden />
      ) : (
        <Circle className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[var(--oe-nc-text-muted)]" aria-hidden />
      )}
      <div className="min-w-0 flex-grow">
        <div className="text-sm font-semibold">{item.label}</div>
        {!item.completed && item.hint && (
          <div className="text-sm text-[var(--oe-nc-text-muted)]">{item.hint}</div>
        )}
      </div>
      {item.manual && !item.completed && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-2 shrink-0"
          disabled={marking}
          onClick={onMark}
        >
          {marking ? '…' : 'Mark done'}
        </Button>
      )}
    </li>
  );
}
