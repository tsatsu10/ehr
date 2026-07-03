import type { ReportHubCard, ReportHubLens } from './reportHubTypes';

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

export function cardKindBadgeClass(kind: ReportHubCard['kind']): string {
  switch (kind) {
    case 'native':
      return 'badge-primary';
    case 'stock':
      return 'badge-secondary';
    case 'module':
      return 'badge-info';
    case 'placeholder':
      return 'badge-light text-muted border';
    default: {
      const never: never = kind;
      return never;
    }
  }
}
