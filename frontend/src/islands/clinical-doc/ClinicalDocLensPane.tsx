import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
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
import {
  consultCardPreviewLine,
  consultCardStatusChip,
} from './clinicalDocCardPreview';

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
  doctorDeskUrl: string;
  onOpenError: (message: string) => void;
  onOpenLabPanel?: () => void;
  onOpenInstructions?: () => void;
  onOpenScreening?: (instrument: string) => void;
  onOpenVitals?: () => void;
  onOpenCertificate?: () => void;
  onOpenEyeExam?: () => void;
}

const SCREENING_INSTRUMENTS = ['phq9', 'gad7'];

async function openForm(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
  card: ClinicalDocCard,
  lens: ClinicalDocLens,
): Promise<void> {
  await openClinicalDocForm(ajaxUrl, csrfToken, visitId, card, { lens, returnTo: 'hub' });
}

/** Backend sends 'YYYY-MM-DD HH:mm' (ClinicalDocVisitSummaryService::formatFormDate) -> regional 'DD/MM/YYYY HH:mm'. */
function formatSavedAt(value: string): string {
  const [datePart, timePart] = value.split(' ');
  const [y, m, d] = (datePart ?? '').split('-');
  if (!d || !m || !y || !/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) {
    return value;
  }
  return timePart ? `${d}/${m}/${y} ${timePart}` : `${d}/${m}/${y}`;
}

function statusLine(card: ClinicalDocCard): string {
  const previewLine = consultCardPreviewLine(card.note_preview);
  if (previewLine) {
    return previewLine;
  }

  if (SCREENING_INSTRUMENTS.includes(card.formdir.toLowerCase())) {
    if (!card.started || typeof card.score_total !== 'number') {
      return 'Not started';
    }
    const scoreText = `${card.score_total}/${card.score_max ?? '?'}${card.score_label ? ` · ${card.score_label}` : ''}`;
    const savedText = card.last_saved_at ? ` · ${formatSavedAt(card.last_saved_at)}` : '';
    return `${scoreText}${savedText}`;
  }

  if (!card.started) {
    return card.primary ? 'Required · Not started' : 'Not started';
  }
  const parts: string[] = [];
  if (card.last_saved_at) {
    parts.push(`Last saved ${formatSavedAt(card.last_saved_at)}`);
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
  doctorDeskUrl,
  onOpenError,
  onOpenLabPanel,
  onOpenInstructions,
  onOpenScreening,
  onOpenVitals,
  onOpenCertificate,
  onOpenEyeExam,
}: ClinicalDocLensPaneProps) {
  if (!visitId) {
    return (
      <div className="nc-clinicaldoc-empty">
        <p className="mb-2 text-[var(--oe-nc-text-muted)]">Open documentation from Doctor Desk with an active visit, or add <code>?visit_id=</code> to the URL.</p>
        <Button variant="outline" size="sm" asChild>
          <a href={doctorDeskUrl}>Go to Doctor Desk</a>
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

  const renderCard = (card: ClinicalDocCard) => {
    const statusChip = consultCardStatusChip(card);
    const preview = card.note_preview;
    const canReviewAndSign = Boolean(
      !card.signed
      && !preview?.signed
      && (card.started || preview?.started)
      && preview?.validate_ready,
    );
    const useNativeInstructions = Boolean(
      onOpenInstructions
      && card.formdir.toLowerCase() === 'clinical_instructions',
    );
    const screeningInstrument = SCREENING_INSTRUMENTS.includes(card.formdir.toLowerCase())
      ? card.formdir.toLowerCase()
      : null;
    const useNativeScreening = Boolean(onOpenScreening && screeningInstrument);
    const useNativeVitals = Boolean(onOpenVitals && card.formdir.toLowerCase() === 'vitals');
    const useNativeCertificate = Boolean(onOpenCertificate && card.formdir.toLowerCase() === 'nc_certificate');
    const useNativeEyeExam = Boolean(onOpenEyeExam && card.formdir.toLowerCase() === 'nc_eye_exam');
    const handleOpen = () => {
      if (useNativeInstructions) {
        onOpenInstructions?.();
        return;
      }
      if (useNativeScreening && screeningInstrument) {
        onOpenScreening?.(screeningInstrument);
        return;
      }
      if (useNativeVitals) {
        onOpenVitals?.();
        return;
      }
      if (useNativeCertificate) {
        onOpenCertificate?.();
        return;
      }
      if (useNativeEyeExam) {
        onOpenEyeExam?.();
        return;
      }
      void openForm(ajaxUrl, csrfToken, visitId, card, lens).catch((err: unknown) => {
        onOpenError(err instanceof Error ? err.message : 'Could not open form');
      });
    };

    return (
    <article key={card.id} className="nc-clinicaldoc-card" role="listitem">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h3 className="nc-clinicaldoc-card-title text-base font-semibold mb-0">{card.title}</h3>
        <Badge variant={statusChip.variant}>{statusChip.label}</Badge>
      </div>
      <p className="nc-clinicaldoc-card-blurb text-sm text-[var(--oe-nc-text-muted)] mb-1">{card.description}</p>
      <p className="nc-clinicaldoc-card-status text-sm mb-2">{statusLine(card)}</p>
      {preview?.problem_labels && preview.problem_labels.length > 0 ? (
        <ul className="text-sm text-[var(--oe-nc-text-muted)] mb-2 pl-4 list-disc">
          {preview.problem_labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      ) : null}
      {card.bundle_health && !card.bundle_health.esign_ok ? (
        <p className="text-sm text-[var(--oe-nc-warning,#b54708)] mb-2">{card.bundle_health.status_label}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {useNativeCertificate && (card.started || preview?.started) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Print the certificate"
            onClick={() => {
              window.open(`certificate-print.php?visit_id=${visitId}`, '_blank', 'noopener');
            }}
          >
            Print
          </Button>
        ) : null}
        {useNativeInstructions && (card.started || preview?.started) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Print the instructions for the patient"
            onClick={() => {
              window.open(`instructions-print.php?visit_id=${visitId}`, '_blank', 'noopener');
            }}
          >
            Print
          </Button>
        ) : null}
        {card.signed || preview?.signed ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpen}
          >
            {useNativeInstructions ? 'View' : 'View note'}
          </Button>
        ) : card.started || preview?.started ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpen}
            >
              Continue
            </Button>
            {canReviewAndSign ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void openClinicalDocForm(ajaxUrl, csrfToken, visitId, card, {
                    lens,
                    returnTo: 'hub',
                    focus: 'sign',
                  }).catch((err: unknown) => {
                    onOpenError(err instanceof Error ? err.message : 'Could not open form');
                  });
                }}
              >
                Review & sign
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpen}
          >
            Open form
          </Button>
        )}
      </div>
    </article>
    );
  };

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
          onOpenInstructions={onOpenInstructions}
          onOpenVitals={onOpenVitals}
          onOpenScreening={onOpenScreening}
          onOpenCertificate={onOpenCertificate}
          onOpenEyeExam={onOpenEyeExam}
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
