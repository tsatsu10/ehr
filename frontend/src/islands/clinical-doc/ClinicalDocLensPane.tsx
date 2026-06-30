import { oeFetch } from '@core/oeFetch';
import type { ClinicalDocCard, ClinicalDocLens, ClinicalDocVisitSummary } from './clinicalDocTypes';
import { openClinicalDocForm } from './clinicalDocApi';

interface ClinicalDocLensPaneProps {
  lens: ClinicalDocLens;
  cards: ClinicalDocCard[];
  loading: boolean;
  error: string | null;
  visitId: number | null;
  ajaxUrl: string;
  csrfToken: string;
  onOpenError: (message: string) => void;
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
  loading,
  error,
  visitId,
  ajaxUrl,
  csrfToken,
  onOpenError,
}: ClinicalDocLensPaneProps) {
  if (!visitId) {
    return (
      <div className="oe-nc-clinicaldoc-empty">
        <p className="mb-2 text-muted">Open documentation from Doctor Desk with an active visit, or add <code>?visit_id=</code> to the URL.</p>
        <a className="btn btn-outline-primary btn-sm" href="../doctor.php">Go to Doctor Desk</a>
      </div>
    );
  }

  if (loading) {
    return <p className="text-muted mb-0">Loading documentation…</p>;
  }

  if (error) {
    return <div className="alert alert-danger mb-0">{error}</div>;
  }

  const lensCards = cards.filter((card) => card.lens === lens || (lens === 'visit' && card.lens === 'visit'));
  const primaryCards = lensCards.filter((card) => !card.more);
  const moreCards = lensCards.filter((card) => card.more);

  if (!lensCards.length) {
    return (
      <div className="oe-nc-clinicaldoc-empty">
        <p className="mb-0 text-muted">No forms are available for this lens with your role and clinic configuration.</p>
      </div>
    );
  }

  const renderCard = (card: ClinicalDocCard) => (
    <article key={card.id} className="oe-nc-clinicaldoc-card" role="listitem">
      <h3 className="oe-nc-clinicaldoc-card__title h6">{card.title}</h3>
      <p className="oe-nc-clinicaldoc-card__blurb small text-muted mb-1">{card.description}</p>
      <p className="oe-nc-clinicaldoc-card__status small mb-2">{statusLine(card)}</p>
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        onClick={() => {
          void openForm(ajaxUrl, csrfToken, visitId, card, lens).catch((err: unknown) => {
            onOpenError(err instanceof Error ? err.message : 'Could not open form');
          });
        }}
      >
        {card.started ? 'Continue editing' : 'Open form'}
      </button>
    </article>
  );

  return (
    <div className="oe-nc-clinicaldoc-cards" role="list">
      {primaryCards.map(renderCard)}
      {moreCards.length > 0 && (
        <details className="oe-nc-clinicaldoc-more mt-2">
          <summary className="small text-muted">More note types</summary>
          <div className="oe-nc-clinicaldoc-cards mt-2" role="list">
            {moreCards.map(renderCard)}
          </div>
        </details>
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
