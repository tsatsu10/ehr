/**
 * PatientBanner — patient context strip rendered at the top of the active triage pane.
 */

import type { PatientPreview, TriageVisit } from '@core/types';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { Badge, badgeVariants } from '@components/ui/badge';
import { BannerClinicalLink } from '@components/BannerClinicalLink';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { buildMrdClinicalDeepLink, MRD_CLINICAL_ANCHORS } from '@core/mrdBannerLinks';
import { cn } from '@/lib/utils';

interface PatientBannerProps {
  preview: PatientPreview;
  visit: TriageVisit;
  chiefComplaint?: string;
}

export function PatientBanner({ preview, visit, chiefComplaint = '' }: PatientBannerProps) {
  const completion = preview.completion;
  const vitalsToday = preview.vitals_today;
  const bannerProps = bannerPropsFromPreview(preview);
  const mrdEnabled = bannerProps.bannerMrdDeepLinks;
  const pid = preview.identity.pid;
  const chartOpenUrl = preview.completion.chart_open_url;
  const vitalsHref = buildMrdClinicalDeepLink(pid, MRD_CLINICAL_ANCHORS.vitals, chartOpenUrl);
  const completionBlocked = completion.score < completion.billing_threshold;
  const missing = completion.missing_labels ?? [];
  const savedChiefComplaint = visit.chief_complaint?.trim() ?? '';
  const draftChiefComplaint = chiefComplaint.trim();
  const bannerChiefComplaint = draftChiefComplaint || savedChiefComplaint;
  const bannerChiefComplaintDraft = !!draftChiefComplaint
    && draftChiefComplaint !== savedChiefComplaint;

  return (
    <PatientContextBanner
      identity={preview.identity}
      layout="compact"
      completion={completion}
      safety={preview.safety}
      chiefComplaint={bannerChiefComplaint}
      chiefComplaintDraft={bannerChiefComplaintDraft}
      {...bannerProps}
      aside={(
        <>
          <Badge variant={completionBlocked ? 'warning' : 'outline'} className="mr-1">
            Completion {completion.score}%
          </Badge>
          {completionBlocked && completion.chart_url && (
            <a href={completion.chart_url} className="text-sm">
              Complete profile
            </a>
          )}
        </>
      )}
    >
      {missing.length > 0 && completionBlocked && (
        <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
          Missing: {missing.slice(0, 2).join(', ')}{missing.length > 2 ? '…' : ''}
        </div>
      )}

      <div className="text-sm mt-1 text-[var(--oe-nc-text-muted)]">
        Visit #{visit.queue_number}
        {' · '}
        {visit.state}
        {visit.visit_type_label ? ` · ${visit.visit_type_label}` : ''}
        {vitalsToday?.vitals_abnormal_today && (
          <BannerClinicalLink
            enabled={mrdEnabled}
            href={vitalsHref}
            className={cn(badgeVariants({ variant: 'danger' }), 'ml-1')}
          >
            Vitals abnormal
          </BannerClinicalLink>
        )}
      </div>

      <div className="text-sm mt-1">
        {vitalsToday?.summary ? (
          <>
            Vitals today:{' '}
            <BannerClinicalLink enabled={mrdEnabled} href={vitalsHref}>
              {vitalsToday.summary}
            </BannerClinicalLink>
          </>
        ) : (
          <BannerClinicalLink
            enabled={mrdEnabled}
            href={vitalsHref}
            className="text-[var(--color-oe-warning,#ea580c)]"
          >
            No vitals today
          </BannerClinicalLink>
        )}
      </div>
    </PatientContextBanner>
  );
}
