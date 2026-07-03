import type { ReactNode } from 'react';
import { ChipCloud } from './ChipCloud';
import { CompletionBar } from './CompletionBar';
import { CompletionScorePill } from './CompletionScorePill';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';
import {
  buildAllergyChips,
  formatIdentityInline,
  formatIdentityMeta,
  initialsFromName,
  type PatientIdentityLine,
  type PatientSafetyChips,
} from './patientBannerUtils';

export interface PatientContextBannerProps {
  identity: PatientIdentityLine;
  /** `full` — avatar header (MRD, Front Desk). `compact` — desk active pane strip. */
  layout?: 'full' | 'compact';
  completion?: { score: number; billing_threshold: number; chart_open_url?: string };
  safety?: PatientSafetyChips;
  bannerMrdDeepLinks?: boolean;
  showAllergyCountChip?: boolean;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
}

export function PatientContextBanner({
  identity,
  layout = 'full',
  completion,
  safety,
  bannerMrdDeepLinks = false,
  showAllergyCountChip = false,
  aside,
  children,
  className,
  id,
}: PatientContextBannerProps) {
  const allergyChips = buildAllergyChips(safety, {
    mrdDeepLinks: bannerMrdDeepLinks,
    pid: identity.pid,
    chartOpenUrl: completion?.chart_open_url,
    showAllergyCountChip,
  });
  const showCompletionBar =
    completion != null && completion.score < completion.billing_threshold;

  if (layout === 'compact') {
    return (
      <>
        {showCompletionBar && completion && (
          <CompletionBar score={completion.score} threshold={completion.billing_threshold} />
        )}
        <div
          className={cn(
            'oe-nc-banner-compact flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-(--oe-nc-border) bg-(--oe-nc-bg-tint) mb-3',
            className
          )}
          id={id}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs">
                {initialsFromName(identity.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="block font-semibold text-sm text-(--oe-nc-text) truncate">
                {formatIdentityInline(identity)}
              </span>
            </div>
          </div>
          {aside != null && (
            <div className="flex items-center flex-wrap gap-2 shrink-0">{aside}</div>
          )}
        </div>
        <ChipCloud chips={allergyChips} />
        {children}
      </>
    );
  }

  return (
    <>
      {showCompletionBar && completion && (
        <CompletionBar score={completion.score} threshold={completion.billing_threshold} />
      )}

      <div className={cn('oe-nc-patient-banner', className)} id={id}>
        <div className="oe-nc-patient-banner__header">
          <Avatar className="oe-nc-patient-banner__avatar-root h-14 w-14 shrink-0">
            <AvatarFallback className="text-lg font-bold">
              {initialsFromName(identity.display_name)}
            </AvatarFallback>
          </Avatar>

          <div className="oe-nc-patient-banner__identity min-w-0 flex-1">
            <h3 className="oe-nc-patient-banner__name truncate">{identity.display_name}</h3>
            <p className="oe-nc-patient-banner__meta">{formatIdentityMeta(identity)}</p>
          </div>

          {aside != null && (
            <div className="oe-nc-patient-banner__aside shrink-0">{aside}</div>
          )}
        </div>

        {allergyChips.length > 0 && (
          <ChipCloud chips={allergyChips} className="oe-nc-patient-banner__safety mt-2" />
        )}

        {children}
      </div>
    </>
  );
}

export { CompletionScorePill, formatIdentityMeta, initialsFromName };
