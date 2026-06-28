import { useCallback, useEffect, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type {
  AppointmentTodayChip,
  DeskVisitType,
  FrontDeskPreviewData,
  VisitStartData,
} from '@core/types';

interface StartVisitFormProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  pid: number;
  preview: FrontDeskPreviewData;
  moduleUrl: string;
  printQueueSlip: boolean;
  autoStart?: boolean;
  onAutoStartConsumed?: () => void;
  onStarted: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function StartVisitForm({
  ajaxUrl,
  csrfToken,
  facilityId,
  pid,
  preview,
  moduleUrl,
  printQueueSlip,
  autoStart = false,
  onAutoStartConsumed,
  onStarted,
  onDirtyChange,
}: StartVisitFormProps) {
  const [types, setTypes] = useState<DeskVisitType[]>([]);
  const [visitTypeId, setVisitTypeId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<VisitStartData | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const autoStartAttemptedRef = useRef(false);

  const appointment: AppointmentTodayChip | null =
    preview.appointment_today ?? preview.chips?.appointment_today ?? null;
  const fromAppointment = !!(appointment?.pc_eid);
  const activeVisit = preview.active_visit;

  useEffect(() => {
    onDirtyChange?.(false);
  }, [activeVisit, fromAppointment, onDirtyChange, pid]);

  useEffect(() => {
    if (activeVisit) return;

    let cancelled = false;

    async function loadTypes() {
      setLoadingTypes(true);
      try {
        const data = await oeFetch<{ visit_types: DeskVisitType[] }>('visit.types', {
          ajaxUrl,
          csrfToken,
          params: facilityId > 0 ? { facility_id: facilityId } : undefined,
        });
        if (cancelled) return;

        let list = data.visit_types ?? [];
        if (fromAppointment) {
          list = list.filter((t) => t.service_profile === 'full_opd');
        }
        setTypes(list);

        const defaultId = fromAppointment && appointment?.default_visit_type_id
          ? String(appointment.default_visit_type_id)
          : String(list.find((t) => t.is_default)?.id ?? list[0]?.id ?? '');
        setVisitTypeId(defaultId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load visit types');
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    }

    void loadTypes();
    return () => {
      cancelled = true;
    };
  }, [
    activeVisit,
    ajaxUrl,
    appointment?.default_visit_type_id,
    csrfToken,
    facilityId,
    fromAppointment,
  ]);

  const startVisit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      const action = fromAppointment ? 'visit.start_from_appointment' : 'visit.start';
      const body: Record<string, unknown> = {
        pid,
        visit_type_id: parseInt(visitTypeId, 10),
        chief_complaint: chiefComplaint.trim(),
        is_urgent: isUrgent,
      };
      if (facilityId > 0) body.facility_id = facilityId;
      if (fromAppointment && appointment) {
        body.pc_eid = appointment.pc_eid;
        body.appt_date = appointment.appt_date;
      }

      const data = await oeFetch<VisitStartData>(action, {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: body,
      });

      const queueNumber = data.visit.queue_number ?? '?';
      let msg = `Visit #${queueNumber} started — patient is on the Triage queue (refresh Triage desk if open).`;
      if (fromAppointment && data.recurring_guard_fired) {
        msg = `Visit #${queueNumber} started. This recurring appointment was not marked ‘Arrived’ in scheduling — update on Flow Board if needed for records.`;
      } else if (fromAppointment && data.appointment_status_updated) {
        msg = `Visit #${queueNumber} started and appointment marked arrived.`;
      }

      setSuccess(data);
      setSuccessMsg(msg);
      onDirtyChange?.(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start visit');
    } finally {
      setSubmitting(false);
    }
  }, [
    ajaxUrl,
    appointment,
    chiefComplaint,
    csrfToken,
    facilityId,
    fromAppointment,
    isUrgent,
    onDirtyChange,
    pid,
    visitTypeId,
  ]);

  useEffect(() => {
    if (!autoStart || autoStartAttemptedRef.current || activeVisit || loadingTypes || !types.length || success) {
      return;
    }
    autoStartAttemptedRef.current = true;
    onAutoStartConsumed?.();
    void startVisit();
  }, [
    activeVisit,
    autoStart,
    loadingTypes,
    onAutoStartConsumed,
    startVisit,
    success,
    types.length,
  ]);

  if (activeVisit) {
    return (
      <div className="alert alert-warning mt-2">
        Patient already has an open visit today.
      </div>
    );
  }

  if (success && successMsg) {
    const visitId = success.visit.id;
    const slipUrl = success.queue_slip_url
      ?? (printQueueSlip && visitId
        ? `${moduleUrl}/queue-slip.php?visit_id=${encodeURIComponent(String(visitId))}&print=1`
        : '');
    const showPrint = printQueueSlip && success.queue_slip_enabled !== false && !!slipUrl;

    return (
      <div className="border-top pt-3 mt-2" id="nc-start-visit-mount">
        <div className="alert alert-success mb-3" id="nc-start-visit-success">
          {successMsg}
        </div>
        <div className="d-flex flex-wrap align-items-center">
          {showPrint && (
            <a
              className="btn btn-primary mr-2 mb-2"
              href={slipUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Print queue slip
            </a>
          )}
          <button
            type="button"
            className="btn btn-outline-secondary mb-2"
            id="nc-start-visit-done"
            onClick={onStarted}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (loadingTypes) {
    return <div className="text-muted small py-2"><em>Loading visit types…</em></div>;
  }

  if (!types.length) {
    return (
      <div className="alert alert-danger mt-2">
        {fromAppointment
          ? 'No OPD visit type available for appointment check-in.'
          : 'No visit types configured.'}
      </div>
    );
  }

  const startLabel = fromAppointment ? 'Start visit & check in' : 'Start visit';
  const startIcon = fromAppointment ? 'fa-calendar-check' : 'fa-play';

  return (
    <div className="border-top pt-3 mt-2" id="nc-start-visit-mount">
      <h6>{startLabel}</h6>
      <div className="form-group">
        <label htmlFor="nc-visit-type">Visit type</label>
        <select
          className="form-control"
          id="nc-visit-type"
          value={visitTypeId}
          onChange={(e) => {
            setVisitTypeId(e.target.value);
            onDirtyChange?.(true);
          }}
        >
          {types.map((type) => (
            <option key={type.id} value={type.id}>{type.label}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="nc-chief-complaint">Reason for visit</label>
        <textarea
          className="form-control"
          id="nc-chief-complaint"
          rows={2}
          maxLength={500}
          value={chiefComplaint}
          onChange={(e) => {
            setChiefComplaint(e.target.value);
            onDirtyChange?.(true);
          }}
        />
      </div>
      <div className="form-group form-check">
        <input
          type="checkbox"
          className="form-check-input"
          id="nc-is-urgent"
          checked={isUrgent}
          onChange={(e) => {
            setIsUrgent(e.target.checked);
            onDirtyChange?.(true);
          }}
        />
        <label className="form-check-label" htmlFor="nc-is-urgent">Urgent</label>
      </div>
      <button
        type="button"
        className="oe-nc-btn-primary-lg"
        id="nc-start-visit-btn"
        disabled={submitting}
        onClick={() => void startVisit()}
      >
        <i className={`fa ${startIcon}`} aria-hidden="true" />
        <span>{submitting ? 'Starting…' : startLabel}</span>
      </button>
      {error && (
        <div className="alert alert-danger mt-2 mb-0" id="nc-start-visit-error">
          {error}
        </div>
      )}
    </div>
  );
}
