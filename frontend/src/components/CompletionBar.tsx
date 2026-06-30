interface CompletionBarProps {
  score: number;
  threshold: number;
  className?: string;
}

/** Thin progress strip when profile completion is below billing threshold. */
export function CompletionBar({ score, threshold, className = 'mb-2' }: CompletionBarProps) {
  if (score >= threshold) return null;

  const width = Math.min(Math.max(score, 0), 100);

  return (
    <div className={`oe-nc-completion-bar ${className}`.trim()}>
      <div
        className="oe-nc-completion-bar__fill"
        style={{ width: `${width}%` }}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completion"
      />
    </div>
  );
}
