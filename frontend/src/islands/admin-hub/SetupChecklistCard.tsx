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
      <div className="card mb-3 border-success">
        <div className="card-body py-3">
          <p className="mb-0 text-success font-weight-bold">
            Setup complete ({progress.score_percent}%)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-3" id="nc-admin-setup-checklist">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-2">
          <div>
            <h5 className="card-title mb-1">Setup checklist</h5>
            <p className="text-muted small mb-0">
              First-run wizard progress (M15-F11) — {progress.score_percent}% complete
            </p>
          </div>
          {progress.can_mark_complete && (
            <button
              type="button"
              className="btn btn-success btn-sm"
              disabled={completing}
              onClick={onMarkComplete}
            >
              {completing ? 'Saving…' : 'Mark setup complete'}
            </button>
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

        <ul className="list-unstyled mb-0">
          {progress.items.map((item) => (
            <SetupChecklistRow
              key={item.key}
              item={item}
              marking={markingKey === item.key}
              onMark={() => onMarkItem(item.key)}
            />
          ))}
        </ul>
      </div>
    </div>
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
    <li className="d-flex align-items-start py-2 border-bottom">
      <span className={`mr-2 ${item.completed ? 'text-success' : 'text-muted'}`} aria-hidden>
        {item.completed ? '✓' : '○'}
      </span>
      <div className="flex-grow-1">
        <div className="small font-weight-bold">{item.label}</div>
        {!item.completed && item.hint && (
          <div className="small text-muted">{item.hint}</div>
        )}
      </div>
      {item.manual && !item.completed && (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm ml-2"
          disabled={marking}
          onClick={onMark}
        >
          {marking ? '…' : 'Mark done'}
        </button>
      )}
    </li>
  );
}
