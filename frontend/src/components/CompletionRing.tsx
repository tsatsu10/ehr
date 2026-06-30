import { completionVariant } from './patientBannerUtils';

interface CompletionRingProps {
  score: number;
  threshold?: number;
  /** Outer diameter in px */
  size?: number;
  className?: string;
  /** Shown below the percentage when provided */
  caption?: string;
}

const STROKE_BY_VARIANT: Record<string, string> = {
  success: 'var(--oe-nc-cta, #059669)',
  warning: 'var(--oe-nc-warning, #ea580c)',
  danger: 'var(--oe-nc-danger, #dc2626)',
};

/**
 * Circular profile-completion gauge (static arc; no spin animation).
 * Replaces the linear bar in desk preview for at-a-glance scoring.
 */
export function CompletionRing({
  score,
  threshold = 70,
  size = 72,
  className = '',
  caption,
}: CompletionRingProps) {
  const clamped = Math.min(Math.max(score, 0), 100);
  const variant = completionVariant(clamped, threshold);
  const stroke = STROKE_BY_VARIANT[variant] ?? STROKE_BY_VARIANT.success;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div
      className={`oe-nc-completion-ring ${className}`.trim()}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Profile ${clamped}% complete`}
    >
      <svg
        className="oe-nc-completion-ring__svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          className="oe-nc-completion-ring__track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        <circle
          className="oe-nc-completion-ring__fill"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="oe-nc-completion-ring__center">
        <span className="oe-nc-completion-ring__value">{clamped}%</span>
        {caption && <span className="oe-nc-completion-ring__caption">{caption}</span>}
      </div>
    </div>
  );
}
