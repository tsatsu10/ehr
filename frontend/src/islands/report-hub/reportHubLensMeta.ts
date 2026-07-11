import type { VariantProps } from 'class-variance-authority';
import type { ReportHubCard, ReportHubLens } from './reportHubTypes';
import { badgeVariants } from '@components/ui/badge';

export type CardKindBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export interface ReportHubLensMeta {
  title: string;
  blurb: string;
  icon: string;
}

export const LENS_META: Record<ReportHubLens, ReportHubLensMeta> = {
  today: {
    title: 'Today',
    blurb: 'Live daily operations — visits, cash, open queue, and end-of-day checks.',
    icon: 'fa-calendar-check-o',
  },
  clinical: {
    title: 'Clinical',
    blurb: 'Patient care, immunizations, and registry exports for clinical staff.',
    icon: 'fa-stethoscope',
  },
  pharmacy: {
    title: 'Pharmacy',
    blurb: 'Dispensing, destroyed medicines, and pharmacy operations.',
    icon: 'fa-medkit',
  },
  financial: {
    title: 'Financial',
    blurb: 'Cash, billing, outstanding balances, and revenue views.',
    icon: 'fa-money',
  },
  public_health: {
    title: 'Public health',
    blurb: 'Population health and surveillance reports. Scheduling totals are orthogonal to visit queue counts.',
    icon: 'fa-globe',
  },
  audit: {
    title: 'Audit',
    blurb: 'Overrides, data quality, and operational audit trails.',
    icon: 'fa-shield',
  },
  unfiled_documents: {
    title: 'Unfiled documents',
    blurb: 'Batch-scanned documents awaiting a patient — file each one before it goes stale.',
    icon: 'fa-file-o',
  },
};

export function cardKindLabel(kind: ReportHubCard['kind']): string {
  switch (kind) {
    case 'native':
      return 'Built-in';
    case 'stock':
      return 'Legacy';
    case 'module':
      return 'Module';
    case 'placeholder':
      return 'Coming soon';
    default: {
      const never: never = kind;
      return never;
    }
  }
}

export function cardKindBadgeVariant(kind: ReportHubCard['kind']): CardKindBadgeVariant {
  switch (kind) {
    case 'native':
      return 'default';
    case 'stock':
      return 'neutral';
    case 'module':
      return 'info';
    case 'placeholder':
      return 'outline';
    default: {
      const never: never = kind;
      return never;
    }
  }
}
