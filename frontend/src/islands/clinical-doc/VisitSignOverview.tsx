import type { ClinicalDocSignOverview } from './clinicalDocTypes';

interface VisitSignOverviewProps {
  overview: ClinicalDocSignOverview;
}

export function VisitSignOverview({ overview }: VisitSignOverviewProps) {
  return (
    <section className="oe-nc-clinicaldoc-sign-overview mb-3" aria-label="Sign overview">
      <h2 className="h6 mb-2">Sign overview</h2>
      <div className="oe-nc-clinicaldoc-sign-overview__stats d-flex flex-wrap mb-2">
        <span className="badge badge-light border mr-2 mb-1">
          {overview.started_count} started
        </span>
        <span className="badge badge-success mr-2 mb-1">
          {overview.signed_count} signed
        </span>
        <span className={`badge mr-2 mb-1 ${overview.unsigned_count > 0 ? 'badge-warning' : 'badge-secondary'}`}>
          {overview.unsigned_count} unsigned
        </span>
        {overview.encounter_signed ? (
          <span className="badge badge-success mb-1">Encounter signed</span>
        ) : (
          <span className="badge badge-warning mb-1">Encounter unsigned</span>
        )}
      </div>
      {overview.required_forms.length > 0 && (
        <ul className="list-unstyled small mb-0 oe-nc-clinicaldoc-sign-overview__required">
          {overview.required_forms.map((form) => (
            <li key={form.formdir} className="mb-1">
              <strong>{form.title}</strong>
              {' · '}
              {form.started ? 'Started, not signed' : 'Required · not started'}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
