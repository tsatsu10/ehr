/**
 * M4-F42 — three-pin clinical form favorites from Doctor Desk.
 */

import { useCallback, useEffect, useState } from 'react';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { oeFetch } from '@core/oeFetch';
import { t } from '@core/i18n';
import type { DoctorVisit } from '@core/types';
import type { ClinicalDocCard } from '../clinical-doc/clinicalDocTypes';
import {
  fetchClinicalDocFavorites,
  openClinicalDocForm,
} from '../clinical-doc/clinicalDocApi';
import { DOCTOR_LEFT_VIA_KEY } from './ConsultShortcuts';
import { setDeskActiveVisitId } from '@core/deskSessionStorage';

const STORAGE_KEY = 'doctor_desk_active_visit_id';

interface DocFavoritesDrawerProps {
  open: boolean;
  visit: DoctorVisit | null;
  ajaxUrl: string;
  csrfToken: string;
  blocked: boolean;
  onClose: () => void;
  onError: (message: string) => void;
}

function statusLine(card: ClinicalDocCard): string {
  if (!card.started) {
    return card.primary ? t('Required · Not started') : t('Not started');
  }
  const parts: string[] = [];
  if (card.signed) {
    parts.push(t('Signed'));
  } else {
    parts.push(t('Not signed'));
  }
  if (card.last_saved_at) {
    parts.push(t('Saved {date}', { date: card.last_saved_at }));
  }
  return parts.join(' · ');
}

export function DocFavoritesDrawer({
  open,
  visit,
  ajaxUrl,
  csrfToken,
  blocked,
  onClose,
  onError,
}: DocFavoritesDrawerProps) {
  const [favorites, setFavorites] = useState<ClinicalDocCard[]>([]);
  const [hubUrl, setHubUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !visit) {
      return;
    }

    setLoading(true);
    setError(null);
    setFavorites([]);

    void fetchClinicalDocFavorites(ajaxUrl, csrfToken, visit.id)
      .then((data) => {
        setFavorites(data.favorites ?? []);
        setHubUrl(data.documentation_hub_url ?? null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('Could not load form favorites'));
      })
      .finally(() => setLoading(false));
  }, [ajaxUrl, csrfToken, open, visit]);

  const openFavorite = useCallback(async (card: ClinicalDocCard) => {
    if (!visit || blocked) {
      return;
    }

    setOpening(card.id);
    setDeskActiveVisitId(STORAGE_KEY, visit.id);
    window.sessionStorage.setItem(DOCTOR_LEFT_VIA_KEY, `form:${card.formdir}`);

    try {
      await openClinicalDocForm(ajaxUrl, csrfToken, visit.id, card, { returnTo: 'doctor' });
    } catch (err) {
      setOpening(null);
      onError(err instanceof Error ? err.message : t('Could not open form'));
    }
  }, [ajaxUrl, blocked, csrfToken, onError, visit]);

  const openFullHub = useCallback(async () => {
    if (!visit || blocked) {
      return;
    }

    setDeskActiveVisitId(STORAGE_KEY, visit.id);
    window.sessionStorage.setItem(DOCTOR_LEFT_VIA_KEY, 'encounter_hub');

    try {
      const data = await oeFetch<{ redirect_url: string }>('doctor.shortcut_preflight', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visit.id, shortcut: 'encounter_hub' },
      });
      window.location.assign(data.redirect_url);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('Could not open documentation hub'));
    }
  }, [ajaxUrl, blocked, csrfToken, onError, visit]);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={t('Quick forms')}
      ariaLabel={t('Clinical form favorites')}
      id="nc-doctor-doc-favorites"
      width="sm"
      footer={(
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocked || !hubUrl}
          onClick={() => { void openFullHub(); }}
        >
          {t('Open full documentation')}
        </Button>
      )}
    >
      {loading ? <p className="text-[var(--oe-nc-text-muted)] mb-0">{t('Loading favorites…')}</p> : null}
      {error ? <div className={deskCalloutClass('error', 'py-2')}>{error}</div> : null}
      {!loading && !error && favorites.length === 0 ? (
        <p className="text-[var(--oe-nc-text-muted)] mb-0">{t('No pinned forms are available for your role and clinic setup.')}</p>
      ) : null}
      <div className="nc-list-group nc-list-group-flush">
        {favorites.map((card) => (
          <div key={card.id} className="nc-list-group-item px-0">
            <div className="flex justify-between items-start">
              <div className="pr-2">
                <div className="font-bold">
                  {card.pin != null ? `${card.pin}. ` : ''}{card.title}
                </div>
                <div className="text-sm text-[var(--oe-nc-text-muted)]">{card.description}</div>
                <div className="text-sm mt-1">{statusLine(card)}</div>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={blocked || opening === card.id}
                onClick={() => { void openFavorite(card); }}
              >
                {opening === card.id ? t('Opening…') : card.started ? t('Continue') : t('Open')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </SlideOver>
  );
}
