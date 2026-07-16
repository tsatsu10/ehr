import { useCallback, useEffect, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { OeFetchError } from '@core/oeFetch';
import type { DoctorVisit, LabPanelPlaceResult } from '@core/types';
import { LabPanelModal } from '../doctor-desk/LabPanelModal';
import { ClinicalDocLensPane, fetchVisitSummary } from './ClinicalDocLensPane';
import { openClinicalDocForm } from './clinicalDocApi';
import type {
  ClinicalDocCard,
  ClinicalDocLens,
  ClinicalDocProps,
  ClinicalDocSignOverview,
} from './clinicalDocTypes';
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
  const [signOverview, setSignOverview] = useState<ClinicalDocSignOverview | null>(null);
  const [addableForms, setAddableForms] = useState<ClinicalDocCard[]>([]);
  const [labPanelOrderEnabled, setLabPanelOrderEnabled] = useState(false);
  const [doctorVisit, setDoctorVisit] = useState<DoctorVisit | null>(null);
  const [contextLabel, setContextLabel] = useState('');
  const [advancedUrl, setAdvancedUrl] = useState<string | null>(null);
  const [encounterSigned, setEncounterSigned] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [pubpid, setPubpid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noEncounter, setNoEncounter] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [labPanelOpen, setLabPanelOpen] = useState(false);
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
      setSignOverview(null);
      setAddableForms([]);
      setDoctorVisit(null);
      setContextLabel('');
      setAdvancedUrl(null);
      return;
    }
    setLoading(true);
    setError(null);
    setNoEncounter(false);
    try {
      const data = await fetchVisitSummary(props.ajaxUrl, props.csrfToken, visitId, tab);
      setCards(data.cards ?? []);
      setSignOverview(data.sign_overview ?? null);
      setAddableForms(data.addable_forms ?? []);
      setLabPanelOrderEnabled(!!data.lab_panel_order_enabled);
      setEncounterSigned(!!data.sign_status?.encounter_signed);
      setPatientName(data.patient?.display_name ?? '');
      setPubpid(data.patient?.pubpid ?? '');
      setAdvancedUrl(data.advanced_encounter_url ?? null);
      setDoctorVisit({
        id: data.visit.id,
        pid: data.visit.pid,
        encounter: data.visit.encounter,
        queue_number: String(data.visit.queue_number ?? ''),
        state: 'with_doctor',
      });
      setContextLabel(
        `Queue #${data.visit?.queue_number ?? '—'} · Encounter ${data.visit?.encounter ?? '—'}`,
      );
    } catch (err) {
      setCards([]);
      setSignOverview(null);
      setAddableForms([]);
      setDoctorVisit(null);
      if (err instanceof OeFetchError && err.code === 'no_encounter_on_visit') {
        setNoEncounter(true);
      } else {
        setError(err instanceof Error ? err.message : 'Could not load visit documentation');
      }
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

  const handleLabPlaced = useCallback((_result: LabPanelPlaceResult) => {
    setLabPanelOpen(false);
    refresh();
  }, [refresh]);

  const procedureOrderCard = useMemo(
    () => cards.find((card) => card.lens === 'orders' && card.formdir.toLowerCase().includes('procedure_order')),
    [cards],
  );

  return (
    <div className="nc-clinicaldoc" id="nc-clinical-doc-root">
      {visitId && patientName ? (
        <PatientContextBanner
          identity={{
            display_name: patientName,
            pubpid,
          }}
          aside={encounterSigned ? (
            <Badge variant="success">Encounter signed</Badge>
          ) : (
            <Badge variant="warning">Unsigned documentation</Badge>
          )}
          className="mb-3"
        />
      ) : null}
      {openError ? <div className={deskCalloutClass('error')}>{openError}</div> : null}
      {noEncounter ? (
        <div className="nc-clinicaldoc-empty">
          <p className="mb-2 text-[var(--oe-nc-text-muted)]">
            This visit hasn&apos;t started yet — documentation opens once the encounter is created at Start visit.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href={props.doctorDeskUrl}>Go to Doctor Desk</a>
          </Button>
        </div>
      ) : (
        <ClinicalDocLensPane
          lens={tab}
          cards={cards}
          signOverview={signOverview}
          addableForms={addableForms}
          labPanelOrderEnabled={labPanelOrderEnabled}
          loading={loading}
          error={error}
          visitId={visitId}
          ajaxUrl={props.ajaxUrl}
          csrfToken={props.csrfToken}
          doctorDeskUrl={props.doctorDeskUrl}
          onOpenError={setOpenError}
          onOpenLabPanel={() => setLabPanelOpen(true)}
        />
      )}
      <LabPanelModal
        open={labPanelOpen}
        visit={doctorVisit}
        ajaxUrl={props.ajaxUrl}
        csrfToken={props.csrfToken}
        facilityId={props.facilityId ?? 0}
        blocked={false}
        onClose={() => setLabPanelOpen(false)}
        onPlaced={handleLabPlaced}
        onFullLabForm={() => {
          setLabPanelOpen(false);
          if (!visitId || !procedureOrderCard) {
            return;
          }
          void openClinicalDocForm(props.ajaxUrl, props.csrfToken, visitId, procedureOrderCard, {
            lens: 'orders',
            returnTo: 'hub',
          }).catch((err: unknown) => {
            setOpenError(err instanceof Error ? err.message : 'Could not open lab form');
          });
        }}
      />
    </div>
  );
}
