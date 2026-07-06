import type { PatientPreview, TriageVisit } from '@core/types';
import { ChipCloud } from '@components/ChipCloud';
import { ChiefComplaintBannerLine } from '@components/ChiefComplaintBannerLine';
import { BannerClinicalLink } from '@components/BannerClinicalLink';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { buildAllergyChips } from '@components/patientBannerUtils';
import { buildMrdClinicalDeepLink, MRD_CLINICAL_ANCHORS } from '@core/mrdBannerLinks';
import { Badge, badgeVariants } from '@components/ui/badge';
import { cn } from '@/lib/utils';

interface TriagePatientBannerProps {
  preview: PatientPreview;
  visit: TriageVisit;
  chiefComplaint?: string;
}

export function TriagePatientBanner({
  preview,
  visit,
  chiefComplaint = '',
}: TriagePatientBannerProps) {
  const completion = preview.completion;
  const vitalsToday = preview.vitals_today;
  const bannerProps = bannerPropsFromPreview(preview);
  const allergyChips = buildAllergyChips(preview.safety, {
    mrdDeepLinks: bannerProps.bannerMrdDeepLinks,
    pid: preview.identity.pid,
    chartOpenUrl: preview.completion?.chart_open_url,
    showAllergyCountChip: bannerProps.showAllergyCountChip,
  });
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

  const stateLabel = visit.state === 'waiting' ? 'Waiting' : 'In triage';

  return (
    <div className="nc-triage-patient-banner">
      <ChipCloud chips={allergyChips} />
      <ChiefComplaintBannerLine
        text={bannerChiefComplaint}
        draft={bannerChiefComplaintDraft}
      />
      <dl className="nc-triage-banner-meta">
        <div className="nc-triage-banner-meta__row">
          <dt className="nc-triage-banner-meta__label">Patient</dt>
          <dd className="nc-triage-banner-meta__value">
            {preview.identity.pubpid}
            {' · '}
            {preview.identity.sex}
            {' · '}
            {preview.identity.age_years}
          </dd>
        </div>
        <div className="nc-triage-banner-meta__row">
          <dt className="nc-triage-banner-meta__label">Visit</dt>
          <dd className="nc-triage-banner-meta__value">
            #{visit.queue_number}
            {' · '}
            {stateLabel}
            {visit.visit_type_label ? ` · ${visit.visit_type_label}` : ''}
          </dd>
        </div>
        <div className="nc-triage-banner-meta__row">
          <dt className="nc-triage-banner-meta__label">Profile</dt>
          <dd className="nc-triage-banner-meta__value">
            <Badge variant={completionBlocked ? 'warning' : 'outline'} className="mr-1">
              Completion {completion.score}%
            </Badge>
            {completionBlocked && completion.chart_url && (
              <a href={completion.chart_url} className="text-sm">
                Complete profile
              </a>
            )}
            {missing.length > 0 && completionBlocked && (
              <span className="block text-sm text-[var(--oe-nc-text-muted)] mt-1">
                Missing: {missing.slice(0, 2).join(', ')}{missing.length > 2 ? '…' : ''}
              </span>
            )}
          </dd>
        </div>
        <div className="nc-triage-banner-meta__row">
          <dt className="nc-triage-banner-meta__label">Vitals today</dt>
          <dd className="nc-triage-banner-meta__value">
            {vitalsToday?.summary ? (
              <BannerClinicalLink enabled={mrdEnabled} href={vitalsHref}>
                {vitalsToday.summary}
              </BannerClinicalLink>
            ) : (
              <BannerClinicalLink
                enabled={mrdEnabled}
                href={vitalsHref}
                className="text-[var(--color-oe-warning,#ea580c)]"
              >
                No vitals today
              </BannerClinicalLink>
            )}
            {vitalsToday?.vitals_abnormal_today && (
              <BannerClinicalLink
                enabled={mrdEnabled}
                href={vitalsHref}
                className={cn(badgeVariants({ variant: 'danger' }), 'ml-1')}
              >
                Vitals abnormal
              </BannerClinicalLink>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
