import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import type { SetupProgressItem, SetupProgressPayload } from './adminTypes';

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
      <Card className="mb-3 border-green-500">
        <CardContent className="py-3">
          <p className="mb-0 text-green-600 font-bold">
            Setup complete ({progress.score_percent}%)
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-3" id="nc-admin-setup-checklist">
      <CardContent>
        <div className="flex flex-wrap justify-between items-center mb-2">
          <div>
            <h5 className="text-base font-semibold mb-1">Setup checklist</h5>
            <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">
              First-run wizard progress (M15-F11) — {progress.score_percent}% complete
            </p>
          </div>
          {progress.can_mark_complete && (
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={completing}
              onClick={onMarkComplete}
            >
              {completing ? 'Saving…' : 'Mark setup complete'}
            </Button>
          )}
        </div>

        <div className="progress mb-3" style={{ height: '8px' }}>
          <div
            className="progress-bar bg-primary"
            role="progressbar"
            style={{ width: `${progress.score_percent}%` }}
            aria-valuenow={progress.score_percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        <ul className="list-none m-0 p-0 mb-0">
          {progress.items.map((item) => (
            <SetupChecklistRow
              key={item.key}
              item={item}
              marking={markingKey === item.key}
              onMark={() => onMarkItem(item.key)}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
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
    <li className="flex items-start py-2 border-bottom">
      <span className={`mr-2 ${item.completed ? 'text-green-600' : 'text-[var(--oe-nc-text-muted)]'}`} aria-hidden>
        {item.completed ? '✓' : '○'}
      </span>
      <div className="flex-grow">
        <div className="text-sm font-bold">{item.label}</div>
        {!item.completed && item.hint && (
          <div className="text-sm text-[var(--oe-nc-text-muted)]">{item.hint}</div>
        )}
      </div>
      {item.manual && !item.completed && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-2"
          disabled={marking}
          onClick={onMark}
        >
          {marking ? '…' : 'Mark done'}
        </Button>
      )}
    </li>
  );
}
