import { useCallback, useEffect, useMemo, useState } from 'react';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { ClinicalDocLensPane, fetchVisitSummary } from './ClinicalDocLensPane';
import type { ClinicalDocCard, ClinicalDocLens, ClinicalDocProps } from './clinicalDocTypes';
import {
  allowedLenses,
  firstAllowedLens,
  useClinicalDocPageHeading,
} from './useClinicalDocPageHeading';
import './main.css';

function readVisitIdFromUrl(): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('visit_id');
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function ClinicalDocHub(props: ClinicalDocProps) {
  const tabs = useMemo(() => allowedLenses(props), [props]);
  const [tab, setTab] = useState<ClinicalDocLens>(() => firstAllowedLens(props.initialTab, tabs));
  const [visitId, setVisitId] = useState<number | null>(() => {
    const fromProps = props.initialVisitId ?? null;
    if (fromProps && fromProps > 0) return fromProps;
    return readVisitIdFromUrl();
  });
  const [cards, setCards] = useState<ClinicalDocCard[]>([]);
  const [contextLabel, setContextLabel] = useState('');
  const [advancedUrl, setAdvancedUrl] = useState<string | null>(null);
  const [encounterSigned, setEncounterSigned] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [pubpid, setPubpid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());

  useEffect(() => {
    const fromUrl = readVisitIdFromUrl();
    if (fromUrl && fromUrl !== visitId) {
      setVisitId(fromUrl);
    }
  }, [visitId]);

  const loadSummary = useCallback(async () => {
    if (!visitId) {
      setCards([]);
      setContextLabel('');
      setAdvancedUrl(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVisitSummary(props.ajaxUrl, props.csrfToken, visitId, tab);
      setCards(data.cards ?? []);
      setEncounterSigned(!!data.sign_status?.encounter_signed);
      setPatientName(data.patient?.display_name ?? '');
      setPubpid(data.patient?.pubpid ?? '');
      setAdvancedUrl(data.advanced_encounter_url ?? null);
      setContextLabel(
        `Queue #${data.visit?.queue_number ?? '—'} · Encounter ${data.visit?.encounter ?? '—'}`,
      );
    } catch (err) {
      setCards([]);
      setError(err instanceof Error ? err.message : 'Could not load visit documentation');
    } finally {
      setLoading(false);
    }
  }, [props.ajaxUrl, props.csrfToken, tab, visitId]);

  const refresh = useCallback(() => {
    setLastUpdated(new Date());
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (visitId) {
      const url = new URL(window.location.href);
      url.searchParams.set('visit_id', String(visitId));
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  }, [tab, visitId]);

  useClinicalDocPageHeading({
    tab,
    contextLabel,
    advancedUrl,
    lastUpdated,
    onTabChange: setTab,
    onRefresh: refresh,
  });

  return (
    <div className="oe-nc-clinicaldoc" id="nc-clinical-doc-root">
      {visitId && patientName ? (
        <PatientContextBanner
          identity={{
            display_name: patientName,
            pubpid,
          }}
          aside={encounterSigned ? (
            <span className="badge badge-success">Encounter signed</span>
          ) : (
            <span className="badge badge-warning">Unsigned documentation</span>
          )}
          className="mb-3"
        />
      ) : null}
      {openError ? <div className="alert alert-danger">{openError}</div> : null}
      <ClinicalDocLensPane
        lens={tab}
        cards={cards}
        loading={loading}
        error={error}
        visitId={visitId}
        ajaxUrl={props.ajaxUrl}
        csrfToken={props.csrfToken}
        onOpenError={setOpenError}
      />
    </div>
  );
}
