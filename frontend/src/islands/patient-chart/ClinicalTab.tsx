import { useEffect, useRef } from 'react';
import type {
  ClinicalBackgroundSection,
  ClinicalData,
  ClinicalLabsStrip,
  ClinicalListSection,
  ClinicalMedsStrip,
  ClinicalReferralsStrip,
  ClinicalThisVisitSection,
  ClinicalVitalsSection,
} from './patientChartTypes';

interface ClinicalTabProps {
  data: ClinicalData | null;
  referralsStrip: ClinicalReferralsStrip | null;
  labsStrip: ClinicalLabsStrip | null;
  medsStrip: ClinicalMedsStrip | null;
  loading: boolean;
  error: string | null;
  clinicalAnchor?: string;
  onScrollToAnchor: (anchor: string) => void;
}

function ClinicalListSectionBlock({
  title,
  section,
  emptyLabel,
}: {
  title: string;
  section: ClinicalListSection;
  emptyLabel: string;
}) {
  const items = section.items ?? [];

  let body: React.ReactNode;
  if (section.undocumented) {
    body = <p className="text-warning small mb-2">Allergies not documented.</p>;
  } else if (section.none_known) {
    body = <p className="text-muted mb-0">No known drug allergies.</p>;
  } else if (items.length) {
    body = (
      <ul className="list-unstyled mb-0">
        {items.map((item, idx) => (
          <li key={`${item.title ?? idx}`} className="mb-2">
            <strong>{item.title}</strong>
            {item.detail && <div className="small text-muted">{item.detail}</div>}
          </li>
        ))}
      </ul>
    );
  } else {
    body = <p className="text-muted mb-0">{emptyLabel}</p>;
  }

  return (
    <section className="border rounded p-3 mb-3" id={section.anchor ?? undefined}>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <h5 className="mb-0">{title}</h5>
        {section.editor_url && (
          <a className="btn btn-sm btn-outline-secondary" href={section.editor_url} target="_top">
            Edit
          </a>
        )}
      </div>
      {body}
    </section>
  );
}

function ClinicalBackground({ section }: { section: ClinicalBackgroundSection }) {
  const lines = section.lines ?? [];

  return (
    <section className="border rounded p-3 mb-3" id={section.anchor ?? 'clinical-background'}>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <h5 className="mb-0">Background</h5>
        {section.editor_url && (
          <a className="btn btn-sm btn-outline-secondary" href={section.editor_url} target="_top">
            Edit history
          </a>
        )}
      </div>
      {lines.length ? (
        <dl className="mb-0">
          {lines.map((line) => (
            <div key={line.label ?? line.value}>
              <dt className="small text-muted">{line.label}</dt>
              <dd className="mb-2">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted mb-0">No background documented.</p>
      )}
    </section>
  );
}

function ClinicalVitals({ section }: { section: ClinicalVitalsSection }) {
  return (
    <section className="border rounded p-3 mb-3" id={section.anchor ?? 'clinical-vitals'}>
      <h5 className="mb-2">Vitals today</h5>
      {section.summary ? (
        <>
          <div>
            {section.summary}
            {section.pain_score !== null &&
              section.pain_score !== undefined &&
              section.pain_score !== '' &&
              ` · Pain ${section.pain_score}`}
          </div>
          {section.abnormal && (section.warnings ?? []).length > 0 && (
            <div className="mt-2">
              {(section.warnings ?? []).map((w) => (
                <span key={w} className="badge badge-danger mr-1">
                  {w}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-muted mb-0">No vitals recorded today.</p>
      )}
    </section>
  );
}

function ClinicalThisVisit({ section }: { section: ClinicalThisVisitSection }) {
  if (section.hidden) return null;

  const forms = section.forms ?? [];

  return (
    <section className="border rounded p-3 mb-3" id={section.anchor ?? 'clinical-encounter-forms'}>
      <div className="d-flex justify-content-between align-items-start mb-2 flex-wrap">
        <h5 className="mb-0">This visit</h5>
        {section.open_encounter_url && (
          <a className="btn btn-sm btn-primary" href={section.open_encounter_url} target="_top">
            Open encounter
          </a>
        )}
      </div>
      {forms.length ? (
        <div className="table-responsive">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>Form</th>
                <th>Date</th>
                <th>Author</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {forms.map((form, idx) => (
                <tr key={`${form.title ?? idx}-${form.date ?? ''}`}>
                  <td>
                    {form.form_url ? (
                      <a href={form.form_url} target="_top">
                        {form.title ?? 'Form'}
                      </a>
                    ) : (
                      form.title ?? 'Form'
                    )}
                  </td>
                  <td className="text-muted small">{form.date ?? '—'}</td>
                  <td className="text-muted small">{form.author ?? '—'}</td>
                  <td className="text-right">
                    <span className={`badge badge-${form.signed ? 'success' : 'secondary'}`}>
                      {form.signed ? 'Signed' : 'Unsigned'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted mb-0">No encounter forms recorded yet.</p>
      )}
    </section>
  );
}

function ReferralsStrip({
  strip,
}: {
  strip: ClinicalReferralsStrip;
}) {
  if (strip.hidden) return null;

  const latest = strip.items?.[0];
  const summary = latest
    ? `${latest.label ?? 'Referral'} · ${latest.status ?? '—'}${latest.occurred_at ? ` · ${latest.occurred_at}` : ''}`
    : 'Referrals on file for this visit.';

  return (
    <section className="border rounded p-3 mb-3 bg-light" id="nc-clinical-referrals-strip">
      <div className="d-flex flex-wrap justify-content-between align-items-start">
        <div className="flex-grow-1 mb-2 mb-md-0">
          <h5 className="mb-1">Referrals</h5>
          <div className="small">→ {summary}</div>
        </div>
        {strip.open_referrals_url && (
          <a className="btn btn-sm btn-outline-primary" href={strip.open_referrals_url} target="_top">
            Open referrals
          </a>
        )}
      </div>
    </section>
  );
}

function LabsStrip({
  strip,
  onScrollToAnchor,
}: {
  strip: ClinicalLabsStrip;
  onScrollToAnchor: (anchor: string) => void;
}) {
  if (strip.hidden) return null;

  return (
    <section
      className={`border rounded p-3 mb-3 bg-light${strip.pending_warning ? ' border-warning' : ''}`}
      id="nc-clinical-labs-strip"
    >
      <div className="d-flex flex-wrap justify-content-between align-items-start">
        <div className="flex-grow-1 mb-2 mb-md-0">
          <h5 className="mb-1">Labs</h5>
          <div className="small">{strip.labs_strip_label ?? 'Labs on file for this visit.'}</div>
        </div>
        <div className="d-flex flex-wrap">
          {strip.lab_ops_url && (
            <a className="btn btn-sm btn-outline-primary mr-2 mb-1" href={strip.lab_ops_url} target="_top">
              Open in Lab Ops
            </a>
          )}
          {strip.place_order_url && (
            <a className="btn btn-sm btn-outline-primary mr-2 mb-1" href={strip.place_order_url} target="_top">
              Place lab order
            </a>
          )}
          {strip.pending_orders_url && (
            <a
              className="btn btn-sm btn-outline-secondary mr-2 mb-1"
              href={strip.pending_orders_url}
              target="_top"
            >
              Pending orders
            </a>
          )}
          {strip.view_trends_anchor && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary mb-1"
              onClick={() => onScrollToAnchor(strip.view_trends_anchor ?? '')}
            >
              View trends
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function MedsStrip({
  strip,
  onScrollToAnchor,
}: {
  strip: ClinicalMedsStrip;
  onScrollToAnchor: (anchor: string) => void;
}) {
  if (strip.hidden) return null;

  return (
    <section
      className={`border rounded p-3 mb-3 bg-light${strip.undispensed_warning ? ' border-warning' : ''}`}
      id="nc-clinical-meds-strip"
    >
      <div className="d-flex flex-wrap justify-content-between align-items-start">
        <div className="flex-grow-1 mb-2 mb-md-0">
          <h5 className="mb-1">Medications</h5>
          <div className="small">{strip.meds_strip_label ?? 'Medications on file for this visit.'}</div>
        </div>
        <div className="d-flex flex-wrap">
          {strip.pharm_ops_url && (
            <a className="btn btn-sm btn-outline-primary mr-2 mb-1" href={strip.pharm_ops_url} target="_top">
              Open in Pharm Ops
            </a>
          )}
          {strip.view_meds_anchor && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary mb-1"
              onClick={() => onScrollToAnchor(strip.view_meds_anchor ?? '')}
            >
              View meds
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function ClinicalTab({
  data,
  referralsStrip,
  labsStrip,
  medsStrip,
  loading,
  error,
  clinicalAnchor,
  onScrollToAnchor,
}: ClinicalTabProps) {
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (!clinicalAnchor || !data || scrolledRef.current) return;
    scrolledRef.current = true;
    onScrollToAnchor(clinicalAnchor);
  }, [clinicalAnchor, data, onScrollToAnchor]);

  if (loading) {
    return <em>Loading clinical summary…</em>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!data) return null;

  const immunizations = data.immunizations;

  return (
    <>
      <ClinicalBackground section={data.background ?? {}} />
      <ClinicalListSectionBlock
        title="Problems"
        section={data.problems ?? {}}
        emptyLabel="No active problems."
      />
      <ClinicalListSectionBlock
        title="Allergies"
        section={data.allergies ?? {}}
        emptyLabel="No allergies on file."
      />
      <ClinicalListSectionBlock
        title="Medications"
        section={data.medications ?? {}}
        emptyLabel="No active medications."
      />
      {!immunizations?.hidden && (
        <ClinicalListSectionBlock
          title="Immunizations"
          section={immunizations ?? {}}
          emptyLabel="No immunizations on file."
        />
      )}
      {referralsStrip && <ReferralsStrip strip={referralsStrip} />}
      {labsStrip && <LabsStrip strip={labsStrip} onScrollToAnchor={onScrollToAnchor} />}
      <ClinicalListSectionBlock title="Labs" section={data.labs ?? {}} emptyLabel="No lab orders on file." />
      {medsStrip && <MedsStrip strip={medsStrip} onScrollToAnchor={onScrollToAnchor} />}
      <ClinicalVitals section={data.vitals ?? {}} />
      <ClinicalThisVisit section={data.this_visit ?? {}} />
    </>
  );
}
