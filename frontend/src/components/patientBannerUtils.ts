import type { PillVariant } from '@core/types';
import { buildMrdClinicalDeepLink, MRD_CLINICAL_ANCHORS } from '@core/mrdBannerLinks';
import type { ChipItem } from './ChipCloud';

export interface PatientIdentityLine {
  pid?: number;
  display_name: string;
  sex?: string;
  age_years?: string | number;
  pubpid?: string;
  phone_masked?: string;
}

/** Map completion score to status-pill / Bootstrap badge variant. */
export function completionVariant(score: number, threshold = 70): PillVariant {
  if (score >= threshold) return 'success';
  if (score >= threshold - 15) return 'warning';
  return 'danger';
}

export function completionBadgeClass(score: number, threshold = 70): string {
  const variant = completionVariant(score, threshold);
  if (variant === 'success') return 'badge-success';
  if (variant === 'warning') return 'badge-warning';
  return 'badge-danger';
}

export function initialsFromName(name?: string): string {
  if (!name?.trim()) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatIdentityMeta(identity: PatientIdentityLine): string {
  return [
    identity.sex || '—',
    identity.age_years ?? '—',
    `MRN ${identity.pubpid || '—'}`,
    identity.phone_masked || null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatIdentityInline(identity: PatientIdentityLine): string {
  return `${identity.display_name} · ${identity.sex ?? '—'} ${identity.age_years ?? '—'} · MRN ${identity.pubpid ?? '—'}`;
}

export interface PatientSafetyChips {
  allergies_severe?: string[];
  allergies_undocumented?: boolean;
  pregnant?: boolean;
  problem_count?: number;
  allergy_count?: number;
}

export interface BuildAllergyChipsOptions {
  mrdDeepLinks?: boolean;
  pid?: number;
  chartOpenUrl?: string;
  showAllergyCountChip?: boolean;
}

function chipHref(
  options: BuildAllergyChipsOptions | undefined,
  anchor: string,
): string | undefined {
  if (!options?.mrdDeepLinks || !options.pid) {
    return undefined;
  }
  return buildMrdClinicalDeepLink(options.pid, anchor, options.chartOpenUrl);
}

export function buildAllergyChips(
  safety?: PatientSafetyChips,
  options?: BuildAllergyChipsOptions,
): ChipItem[] {
  if (!safety) return [];

  const chips: ChipItem[] = [];
  const allergyHref = chipHref(options, MRD_CLINICAL_ANCHORS.allergies);
  const problemsHref = chipHref(options, MRD_CLINICAL_ANCHORS.problems);

  if (safety.pregnant) {
    chips.push({
      label: 'Pregnant',
      variant: 'warn',
      href: problemsHref,
    });
  }

  if (safety.allergies_undocumented) {
    chips.push({
      label: 'Allergies undocumented',
      variant: 'warn',
      href: allergyHref,
    });
    return chips;
  }

  const severe = safety.allergies_severe ?? [];
  const allergyCount = safety.allergy_count ?? severe.length;

  if (options?.showAllergyCountChip && allergyCount > 3) {
    chips.push({
      label: `${allergyCount} allergies`,
      variant: 'warn',
      href: allergyHref,
    });
    return chips;
  }

  severe.slice(0, 3).forEach((allergy) => {
    chips.push({ label: allergy, variant: 'severe', href: allergyHref });
  });

  const extra = severe.length - 3;
  if (extra > 0) {
    chips.push({ label: `+${extra} more`, variant: 'warn', href: allergyHref });
  }

  if (safety.problem_count != null && safety.problem_count > 0) {
    chips.push({
      label: `${safety.problem_count} problem${safety.problem_count === 1 ? '' : 's'}`,
      variant: 'warn',
      href: problemsHref,
    });
  }

  return chips;
}
