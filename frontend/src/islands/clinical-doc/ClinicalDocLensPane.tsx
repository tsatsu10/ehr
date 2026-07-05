import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import type {
  ClinicalDocCard,
  ClinicalDocLens,
  ClinicalDocSignOverview,
  ClinicalDocVisitSummary,
} from './clinicalDocTypes';
import { AddFormPicker } from './AddFormPicker';
import { VisitSignOverview } from './VisitSignOverview';
import { openClinicalDocForm } from './clinicalDocApi';

interface ClinicalDocLensPaneProps {
  lens: ClinicalDocLens;
  cards: ClinicalDocCard[];
  signOverview?: ClinicalDocSignOverview | null;
  addableForms?: ClinicalDocCard[];
  labPanelOrderEnabled?: boolean;
  loading: boolean;
  error: string | null;
  visitId: number | null;
  ajaxUrl: string;
  csrfToken: string;
  onOpenError: (message: string) => void;
  onOpenLabPanel?: () => void;
}

async function openForm(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
  card: ClinicalDocCard,
  lens: ClinicalDocLens,
): Promise<void> {
  await openClinicalDocForm(ajaxUrl, csrfToken, visitId, card, { lens, returnTo: 'hub' });
}

function statusLine(card: ClinicalDocCard): string {
  if (!card.started) {
    return card.primary ? 'Required · Not started' : 'Not started';
  }
  const parts: string[] = [];
  if (card.last_saved_at) {
    parts.push(`Last saved ${card.last_saved_at}`);
  }
  if (card.last_saved_by) {
    parts.push(`by ${card.last_saved_by}`);
  }
  if (card.signed) {
    parts.push('Signed');
  } else {
    parts.push('Not signed');
  }
  return parts.join(' · ');
}

export function ClinicalDocLensPane({
  lens,
  cards,
  signOverview,
  addableForms = [],
  labPanelOrderEnabled = false,
  loading,
  error,
  visitId,
  ajaxUrl,
  csrfToken,
  onOpenError,
  onOpenLabPanel,
}: ClinicalDocLensPaneProps) {
  if (!visitId) {
    return (
      <div className="nc-clinicaldoc-empty">
        <p className="mb-2 text-[var(--oe-nc-text-muted)]">Open documentation from Doctor Desk with an active visit, or add <code>?visit_id=</code> to the URL.</p>
        <Button variant="outline" size="sm" asChild>
          <a href="../doctor.php">Go to Doctor Desk</a>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <p className="text-[var(--oe-nc-text-muted)] mb-0">Loading documentation…</p>;
  }

  if (error) {
    return <div className={deskCalloutClass('error', 'mb-0')}>{error}</div>;
  }

  const lensCards = cards.filter((card) => card.lens === lens || (lens === 'visit' && card.lens === 'visit'));
  const primaryCards = lensCards.filter((card) => !card.more);
  const moreCards = lensCards.filter((card) => card.more);

  if (!lensCards.length && lens !== 'visit') {
    return (
      <div className="nc-clinicaldoc-empty">
        <p className="mb-0 text-[var(--oe-nc-text-muted)]">No forms are available for this lens with your role and clinic configuration.</p>
      </div>
    );
  }

  const renderCard = (card: ClinicalDocCard) => (
    <article key={card.id} className="nc-clinicaldoc-card" role="listitem">
      <h3 className="nc-clinicaldoc-card-title text-base font-semibold">{card.title}</h3>
      <p className="nc-clinicaldoc-card-blurb text-sm text-[var(--oe-nc-text-muted)] mb-1">{card.description}</p>
      <p className="nc-clinicaldoc-card-status text-sm mb-2">{statusLine(card)}</p>
      {card.bundle_health && !card.bundle_health.esign_ok ? (
        <p className="text-sm text-[var(--color-oe-warning,#ea580c)] mb-2">{card.bundle_health.status_label}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void openForm(ajaxUrl, csrfToken, visitId, card, lens).catch((err: unknown) => {
            onOpenError(err instanceof Error ? err.message : 'Could not open form');
          });
        }}
      >
        {card.started ? 'Continue editing' : 'Open form'}
      </Button>
    </article>
  );

  return (
    <div>
      {lens === 'visit' && signOverview ? <VisitSignOverview overview={signOverview} /> : null}
      {lens === 'visit' && addableForms.length > 0 ? (
        <AddFormPicker
          addableForms={addableForms}
          visitId={visitId}
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          lens={lens}
          onOpenError={onOpenError}
        />
      ) : null}
      {lens === 'orders' && labPanelOrderEnabled && onOpenLabPanel ? (
        <div className="nc-clinicaldoc-lab-panel mb-3">
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">Quick order common lab tests without opening the full lab form.</p>
          <Button type="button" variant="outline" size="sm" onClick={onOpenLabPanel}>
            Quick lab panel
          </Button>
        </div>
      ) : null}
      {!lensCards.length ? (
        <div className="nc-clinicaldoc-empty">
          <p className="mb-0 text-[var(--oe-nc-text-muted)]">No started or required forms on this visit yet. Use Add form to begin documentation.</p>
        </div>
      ) : (
        <div className="nc-clinicaldoc-cards" role="list">
          {primaryCards.map(renderCard)}
          {moreCards.length > 0 && (
            <details className="nc-clinicaldoc-more mt-2">
              <summary className="text-sm text-[var(--oe-nc-text-muted)]">More note types</summary>
              <div className="nc-clinicaldoc-cards mt-2" role="list">
                {moreCards.map(renderCard)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export async function fetchVisitSummary(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
  lens: ClinicalDocLens,
): Promise<ClinicalDocVisitSummary> {
  return oeFetch<ClinicalDocVisitSummary>('clinical_doc.visit_summary', {
    ajaxUrl,
    csrfToken,
    params: { visit_id: visitId, lens },
  });
}
