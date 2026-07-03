export type AncillaryVisitBadgeKey =
  | 'lab_direct'
  | 'pharmacy_walkin'
  | 'referral_on_file'
  | 'referred_to_opd';

export const ANCILLARY_BADGE_META: Record<
  AncillaryVisitBadgeKey,
  { label: string; className: string; title?: string }
> = {
  lab_direct: { label: 'Direct lab', className: 'badge-info' },
  pharmacy_walkin: { label: 'Pharmacy walk-in', className: 'badge-info' },
  referral_on_file: { label: 'Referral on file', className: 'badge-secondary' },
  referred_to_opd: {
    label: 'Referred to OPD',
    className: 'badge-secondary',
    title: 'Pharmacy walk-in referred this patient to OPD today',
  },
};

export function isAncillaryVisitBadgeKey(value: string): value is AncillaryVisitBadgeKey {
  return value in ANCILLARY_BADGE_META;
}

interface AncillaryVisitBadgesProps {
  badges?: readonly string[] | null;
  className?: string;
}

export function AncillaryVisitBadges({
  badges,
  className = 'ml-1',
}: AncillaryVisitBadgesProps) {
  if (!badges?.length) {
    return null;
  }

  return (
    <>
      {badges.map((key) => {
        if (!isAncillaryVisitBadgeKey(key)) {
          return null;
        }
        const meta = ANCILLARY_BADGE_META[key];
        return (
          <span
            key={key}
            className={`badge ${meta.className} ${className}`.trim()}
            title={meta.title}
          >
            {meta.label}
          </span>
        );
      })}
    </>
  );
}
