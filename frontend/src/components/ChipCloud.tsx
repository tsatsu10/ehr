import { cn } from '@/lib/utils';
import { badgeVariants } from './ui/badge';

export interface ChipItem {
  label: string;
  variant: 'severe' | 'warn';
  href?: string;
}

interface ChipCloudProps {
  chips: ChipItem[];
  className?: string;
}

function chipBadgeVariant(variant: ChipItem['variant']): 'danger' | 'warning' {
  return variant === 'severe' ? 'danger' : 'warning';
}

export function ChipCloud({ chips, className }: ChipCloudProps) {
  if (!chips.length) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {chips.map((chip) => {
        const badgeClass = badgeVariants({ variant: chipBadgeVariant(chip.variant) });
        if (chip.href) {
          return (
            <a
              key={chip.label}
              href={chip.href}
              target="_blank"
              rel="noopener noreferrer"
              className={badgeClass}
            >
              {chip.label}
            </a>
          );
        }
        return (
          <span key={chip.label} className={badgeClass}>
            {chip.label}
          </span>
        );
      })}
    </div>
  );
}
