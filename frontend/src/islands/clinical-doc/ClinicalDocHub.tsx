import { useCallback, useEffect, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { OeFetchError } from '@core/oeFetch';
import type { DoctorVisit, LabPanelPlaceResult } from '@core/types';
import { LabPanelModal } from '../doctor-desk/LabPanelModal';
import { ClinicalDocLensPane, fetchVisitSummary } from './ClinicalDocLensPane';
import { ClinicalInstructionsDrawer } from './ClinicalInstructionsDrawer';
import { CertificateDrawer } from './CertificateDrawer';
import { EyeExamDrawer } from './EyeExamDrawer';
import { ScreeningDrawer } from './ScreeningDrawer';
import { VitalsDrawer } from './VitalsDrawer';
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

function readIdFromUrl(param: 'visit_id' | 'encounter_id'): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(param);
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function readVisitIdFromUrl(): number | null {
  return readIdFromUrl('visit_id');
}

export function ClinicalDocHub(props: ClinicalDocProps) {
  const tabs = useMemo(() => allowedLenses(props), [props]);
  const [tab, setTab] = useState<ClinicalDocLens>(() => firstAllowedLens(props.initialTab, tabs));
  const [visitId, setVisitId] = useState<number | null>(() => {
    const fromProps = props.initialVisitId ?? null;
    if (fromProps && fromProps > 0) return fromProps;
    return readVisitIdFromUrl();
  });
  // Encounter-only mode: a stock/historical encounter with no queue visit row.
  const [encounterId] = useState<number | null>(() => {
    const fromProps = props.initialEncounterId ?? null;
    if (fromProps && fromProps > 0) return fromProps;
    return readIdFromUrl('encounter_id');
  });
  const [encounterOnly, setEncounterOnly] = useState(false);
  const [encounterDate, setEncounterDate] = useState('');
  const [cards, setCards] = useState<ClinicalDocCard[]>([]);
  const [signOverview, setSignOverview] = useState<ClinicalDocSignOverview | null>(null);
  const [addableForms, setAddableForms] = useState<ClinicalDocCard[]>([]);
  const [labPanelOrderEnabled, setLabPanelOrderEnabled] = useState(false);
  const [doctorVisit, setDoctorVisit] = useState<DoctorVisit | null>(null);
  const [contextLabel, setContextLabel] = useState('');
  const [encounterSigned, setEncounterSigned] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [pubpid, setPubpid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noEncounter, setNoEncounter] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [labPanelOpen, setLabPanelOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [screeningInstrument, setScreeningInstrument] = useState<string | null>(null);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [eyeExamOpen, setEyeExamOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());

  useEffect(() => {
    const fromUrl = readVisitIdFromUrl();
    if (fromUrl && fromUrl !== visitId) {
      setVisitId(fromUrl);
    }
  }, [visitId]);

  // Callers that navigate to the hub (Doctor Desk favorites, deep links, or the
  // openForm fallback) land with ?open_form=<formdir> — open the matching native
  // drawer and strip the param so a refresh doesn't reopen it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openForm = params.get('open_form');
    if (!openForm) return;
    if (openForm === 'clinical_instructions') {
      setInstructionsOpen(true);
    } else if (openForm === 'phq9' || openForm === 'gad7') {
      setScreeningInstrument(openForm);
    } else if (openForm === 'vitals') {
      setVitalsOpen(true);
    } else if (openForm === 'nc_certificate') {
      setCertificateOpen(true);
    } else if (openForm === 'nc_eye_exam') {
      setEyeExamOpen(true);
    } else {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('open_form');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const loadSummary = useCallback(async () => {
    if (!visitId && !encounterId) {
      setCards([]);
      setSignOverview(null);
      setAddableForms([]);
      setDoctorVisit(null);
      setContextLabel('');
      return;
    }
    setLoading(true);
    setError(null);
    setNoEncounter(false);
    try {
      const data = await fetchVisitSummary(props.ajaxUrl, props.csrfToken, visitId ?? 0, tab, encounterId ?? 0);
      setCards(data.cards ?? []);
      setSignOverview(data.sign_overview ?? null);
      setAddableForms(data.addable_forms ?? []);
      setLabPanelOrderEnabled(!!data.lab_panel_order_enabled);
      setEncounterSigned(!!data.sign_status?.encounter_signed);
      setPatientName(data.patient?.display_name ?? '');
      setPubpid(data.patient?.pubpid ?? '');
      setEncounterOnly(!!data.visit?.encounter_only);
      setEncounterDate(data.visit?.encounter_date ?? '');
      // The encounter turned out to have a queue visit — upgrade to full visit mode.
      if (!visitId && data.visit?.id) {
        setVisitId(data.visit.id);
      }
      setDoctorVisit({
        id: data.visit.id,
        pid: data.visit.pid,
        encounter: data.visit.encounter,
        queue_number: String(data.visit.queue_number ?? ''),
        state: 'with_doctor',
      });
      setContextLabel(
        data.visit?.encounter_only
          ? `Past encounter ${data.visit?.encounter ?? '—'}`
          : `Queue #${data.visit?.queue_number ?? '—'} · Encounter ${data.visit?.encounter ?? '—'}`,
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
  }, [props.ajaxUrl, props.csrfToken, tab, visitId, encounterId]);

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
      url.searchParams.delete('encounter_id');
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    } else if (encounterId) {
      const url = new URL(window.location.href);
      url.searchParams.set('encounter_id', String(encounterId));
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  }, [tab, visitId, encounterId]);

  useClinicalDocPageHeading({
    tab,
    contextLabel,
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
      {(visitId || encounterId) && patientName ? (
        <PatientContextBanner
          identity={{
            display_name: patientName,
            pubpid,
          }}
          aside={(
            <span className="flex items-center gap-2">
              {encounterOnly ? (
                <Badge variant="neutral">
                  {encounterDate ? `Past encounter · ${encounterDate.split('-').reverse().join('/')}` : 'Past encounter'}
                </Badge>
              ) : null}
              {encounterSigned ? (
                <Badge variant="success">Encounter signed</Badge>
              ) : (
                <Badge variant="warning">Unsigned documentation</Badge>
              )}
            </span>
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
          encounterId={encounterId}
          ajaxUrl={props.ajaxUrl}
          csrfToken={props.csrfToken}
          doctorDeskUrl={props.doctorDeskUrl}
          onOpenError={setOpenError}
          onOpenLabPanel={visitId ? () => setLabPanelOpen(true) : undefined}
          onOpenInstructions={visitId ? () => setInstructionsOpen(true) : undefined}
          onOpenScreening={visitId ? (instrument) => setScreeningInstrument(instrument) : undefined}
          onOpenVitals={visitId ? () => setVitalsOpen(true) : undefined}
          onOpenCertificate={visitId ? () => setCertificateOpen(true) : undefined}
          onOpenEyeExam={visitId ? () => setEyeExamOpen(true) : undefined}
        />
      )}
      <ClinicalInstructionsDrawer
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        ajaxUrl={props.ajaxUrl}
        csrfToken={props.csrfToken}
        visitId={visitId}
        patientLabel={patientName ? `${patientName}${pubpid ? ` · ${pubpid}` : ''}` : ''}
        onSaved={() => {
          setInstructionsOpen(false);
          refresh();
        }}
      />
      <ScreeningDrawer
        open={screeningInstrument !== null}
        onClose={() => setScreeningInstrument(null)}
        ajaxUrl={props.ajaxUrl}
        csrfToken={props.csrfToken}
        visitId={visitId}
        instrument={screeningInstrument}
        patientLabel={patientName ? `${patientName}${pubpid ? ` · ${pubpid}` : ''}` : ''}
        onSaved={() => {
          setScreeningInstrument(null);
          refresh();
        }}
      />
      <EyeExamDrawer
        open={eyeExamOpen}
        onClose={() => setEyeExamOpen(false)}
        ajaxUrl={props.ajaxUrl}
        csrfToken={props.csrfToken}
        visitId={visitId}
        patientLabel={patientName ? `${patientName}${pubpid ? ` · ${pubpid}` : ''}` : ''}
        onSaved={() => {
          setEyeExamOpen(false);
          refresh();
        }}
      />
      <CertificateDrawer
        open={certificateOpen}
        onClose={() => setCertificateOpen(false)}
        ajaxUrl={props.ajaxUrl}
        csrfToken={props.csrfToken}
        visitId={visitId}
        patientLabel={patientName ? `${patientName}${pubpid ? ` · ${pubpid}` : ''}` : ''}
        onSaved={() => {
          setCertificateOpen(false);
          refresh();
        }}
      />
      <VitalsDrawer
        open={vitalsOpen}
        onClose={() => setVitalsOpen(false)}
        ajaxUrl={props.ajaxUrl}
        csrfToken={props.csrfToken}
        visitId={visitId}
        patientLabel={patientName ? `${patientName}${pubpid ? ` · ${pubpid}` : ''}` : ''}
        onSaved={() => {
          setVitalsOpen(false);
          refresh();
        }}
      />
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
