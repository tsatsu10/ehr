import { PatientContextBanner } from '@components/PatientContextBanner';
import { ChiefComplaintBannerLine } from '@components/ChiefComplaintBannerLine';
import { SlideOver } from '@components/SlideOver';
import { StatusPill } from '@components/StatusPill';
import { Button } from '@components/ui/button';
import type { VisitDetailAuditItem, VisitDetailData } from '@core/types';

interface VisitDetailDrawerProps {
  open: boolean;
  data: VisitDetailData | null;
  onClose: () => void;
}

function AuditTimeline({ items }: { items: VisitDetailAuditItem[] }) {
  if (!items.length) {
    return <em className="text-[var(--oe-nc-text-muted)] text-sm">No recent activity.</em>;
  }

  return (
    <ul className="list-none m-0 p-0 mb-0">
      {items.map((item, index) => (
        <li key={`${item.at}-${index}`} className="mb-2">
          <div>{item.label}</div>
          {item.subtitle && <div className="text-sm text-[var(--oe-nc-text-muted)]">{item.subtitle}</div>}
          {item.at_label && <div className="text-sm text-[var(--oe-nc-text-muted)]">{item.at_label}</div>}
        </li>
      ))}
    </ul>
  );
}

export function VisitDetailDrawer({ open, data, onClose }: VisitDetailDrawerProps) {
  if (!data) return null;

  const summary = data.visit_summary;
  const visit = data.visit;
  const preview = data.preview;
  const identity = preview?.identity;
  const completion = preview?.completion;
  const title = `#${summary.queue_number || visit.queue_number || '?'} · ${
    summary.state_label || visit.state
  }`;
  const chiefComplaint = summary.chief_complaint ?? visit.chief_complaint;

  const footer = (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={onClose}>
        Close drawer
      </Button>
      {data.chart_history_url && (
        <Button type="button" variant="outline" size="sm" asChild>
          <a
            id="nc-visit-drawer-history"
            href={data.chart_history_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View full history
          </a>
        </Button>
      )}
    </>
  );

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={title}
      id="nc-visit-detail-drawer"
      titleId="nc-visit-drawer-title"
      width="md"
      footer={footer}
    >
      <div id="nc-visit-drawer-body">
        {identity && preview ? (
          <PatientContextBanner
            layout="compact"
            identity={identity}
            completion={completion}
            safety={preview.safety}
            bannerMrdDeepLinks={preview.banner_mrd_deep_links}
            showAllergyCountChip={preview.allergy_count_chip}
            chiefComplaint={chiefComplaint}
            chiefComplaintId="nc-visit-drawer-cc"
            aside={(
              <StatusPill
                state={visit.state}
                queueNumber={String(visit.queue_number)}
              />
            )}
            className="mb-3"
            id="nc-visit-drawer-banner"
          />
        ) : chiefComplaint ? (
          <ChiefComplaintBannerLine text={chiefComplaint} id="nc-visit-drawer-cc" />
        ) : null}
        <div className="mb-3">
          <div className="text-sm text-[var(--oe-nc-text-muted)]">
            {summary.visit_type_label}
            {summary.started_at_label ? ` · Started ${summary.started_at_label}` : ''}
            {summary.provider_hint ? ` · ${summary.provider_hint}` : ''}
          </div>
        </div>
        <h6 className="text-sm uppercase text-[var(--oe-nc-text-muted)]">Audit timeline</h6>
        <AuditTimeline items={data.audit_timeline ?? []} />
      </div>
    </SlideOver>
  );
}
