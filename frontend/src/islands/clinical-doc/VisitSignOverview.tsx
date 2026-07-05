import type { ClinicalDocSignOverview } from './clinicalDocTypes';
import { Badge } from '@components/ui/badge';

interface VisitSignOverviewProps {
  overview: ClinicalDocSignOverview;
}

export function VisitSignOverview({ overview }: VisitSignOverviewProps) {
  return (
    <section className="nc-clinicaldoc-sign-overview mb-3" aria-label="Sign overview">
      <h2 className="text-sm font-semibold mb-2">Sign overview</h2>
      <div className="nc-clinicaldoc-sign-overview-stats flex flex-wrap mb-2">
        <Badge variant="outline" className="mr-2 mb-1">
          {overview.started_count} started
        </Badge>
        <Badge variant="success" className="mr-2 mb-1">
          {overview.signed_count} signed
        </Badge>
        <Badge variant={overview.unsigned_count > 0 ? 'warning' : 'neutral'} className="mr-2 mb-1">
          {overview.unsigned_count} unsigned
        </Badge>
        {overview.encounter_signed ? (
          <Badge variant="success" className="mb-1">Encounter signed</Badge>
        ) : (
          <Badge variant="warning" className="mb-1">Encounter unsigned</Badge>
        )}
      </div>
      {overview.required_forms.length > 0 && (
        <ul className="list-none m-0 p-0 text-sm mb-0 nc-clinicaldoc-sign-overview-required">
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
