import { Progress } from './ui/progress';
import { completionVariant } from './patientBannerUtils';
import { cn } from '@/lib/utils';

interface CompletionBarProps {
  score: number;
  threshold: number;
  className?: string;
}

const INDICATOR_BY_VARIANT: Record<string, string> = {
  success: 'bg-[var(--oe-nc-cta,#059669)]',
  warning: 'bg-[var(--oe-nc-warning,#ea580c)]',
  danger: 'bg-[var(--oe-nc-danger,#dc2626)]',
};

/** Thin progress strip when profile completion is below billing threshold. */
export function CompletionBar({ score, threshold, className = 'mb-2' }: CompletionBarProps) {
  if (score >= threshold) return null;

  const variant = completionVariant(score, threshold);
  const indicatorClassName = INDICATOR_BY_VARIANT[variant] ?? INDICATOR_BY_VARIANT.success;

  return (
    <Progress
      value={score}
      max={100}
      className={cn('oe-nc-completion-bar', className)}
      indicatorClassName={indicatorClassName}
      aria-label="Profile completion"
    />
  );
}
