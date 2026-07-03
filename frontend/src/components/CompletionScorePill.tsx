import { Badge } from './ui/badge';
import { completionVariant } from './patientBannerUtils';
import type { BadgeProps } from './ui/badge';

interface CompletionScorePillProps {
  score: number;
  threshold?: number;
  className?: string;
}

export function CompletionScorePill({ score, threshold = 70, className }: CompletionScorePillProps) {
  const variant = completionVariant(score, threshold);

  return (
    <Badge variant={variant as BadgeProps['variant']} className={className}>
      {score}% complete
    </Badge>
  );
}
