import type { ReactNode } from 'react';
import { ChipCloud } from './ChipCloud';
import { ChiefComplaintBannerLine } from './ChiefComplaintBannerLine';
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
  /** Tier 1 `new_visit.chief_complaint` one-liner (PAGE_DESIGNS §4.11.1). */
  chiefComplaint?: string | null;
  chiefComplaintDraft?: boolean;
  chiefComplaintId?: string;
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
  chiefComplaint,
  chiefComplaintDraft = false,
  chiefComplaintId,
}: PatientContextBannerProps) {
  const allergyChips = buildAllergyChips(safety, {
    mrdDeepLinks: bannerMrdDeepLinks,
    pid: identity.pid,
    chartOpenUrl: completion?.chart_open_url,
    showAllergyCountChip,
  });
  const showCompletionBar =
    completion != null && completion.score < completion.billing_threshold;
  const chiefComplaintLine = chiefComplaint?.trim()
    ? (
      <ChiefComplaintBannerLine
        text={chiefComplaint}
        draft={chiefComplaintDraft}
        id={chiefComplaintId}
      />
    )
    : null;

  if (layout === 'compact') {
    return (
      <>
        {showCompletionBar && completion && (
          <CompletionBar score={completion.score} threshold={completion.billing_threshold} />
        )}
        <div
          className={cn(
            'flex items-center justify-between gap-3 px-4 py-3 rounded-[0.25rem] border border-(--oe-nc-border) border-l-4 border-l-(--oe-nc-primary) bg-white mb-3',
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
        {chiefComplaintLine}
        {children}
      </>
    );
  }

  return (
    <>
      {showCompletionBar && completion && (
        <CompletionBar score={completion.score} threshold={completion.billing_threshold} />
      )}

      <div
        className={cn(
          'flex flex-col gap-3 rounded-[0.25rem] border border-(--oe-nc-border) border-l-4 border-l-(--oe-nc-primary) bg-white px-4 py-3.5 mb-3',
          className
        )}
        id={id}
      >
        <div className="flex items-start gap-3.5 flex-wrap">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarFallback className="text-lg font-bold">
              {initialsFromName(identity.display_name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-(--oe-nc-text) mb-0.5 leading-tight tracking-tight">
              {identity.display_name}
            </h3>
            <p className="text-[0.8125rem] leading-snug text-(--oe-nc-text-muted)">
              {formatIdentityMeta(identity)}
            </p>
          </div>

          {aside != null && (
            <div className="shrink-0">{aside}</div>
          )}
        </div>

        {allergyChips.length > 0 && (
          <ChipCloud chips={allergyChips} className="flex flex-wrap gap-1.5" />
        )}

        {chiefComplaintLine}

        {children}
      </div>
    </>
  );
}

export { CompletionScorePill, formatIdentityMeta, initialsFromName };
