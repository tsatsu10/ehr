import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';

interface CertificateRow {
  id: number;
  cert_no: string;
  cert_type: string;
  rest_from: string | null;
  rest_to: string | null;
  remarks: string | null;
  include_diagnosis: number;
  diagnosis_text: string | null;
  print_count: number;
}

interface CertificatePayload {
  enabled: boolean;
  visit_id: number;
  types: Record<string, string>;
  certificate: CertificateRow | null;
  locked?: boolean;
}

interface CertificateDrawerProps {
  open: boolean;
  onClose: () => void;
  ajaxUrl: string;
  csrfToken: string;
  visitId: number | null;
  patientLabel: string;
  onSaved: () => void;
}

const REST_TYPES = ['excuse_duty', 'school_absence'];

// Same anti-flood pattern as the other native drawers.
const certCache = new Map<number, CertificatePayload>();
const inflightGets = new Map<number, Promise<CertificatePayload>>();

/** Test hook — module-level caches would otherwise leak between test cases. */
export function clearCertificateCachesForTest(): void {
  certCache.clear();
  inflightGets.clear();
}

/**
 * Medical certificate drawer — numbered, auditable excuse-duty / school-note
 * document. Editable until first print; after printing, saving issues a NEW
 * certificate number and supersedes the old one (a printed document must never
 * silently change). Diagnosis is included only with the explicit consent box.
 */
export function CertificateDrawer({
  open,
  onClose,
  ajaxUrl,
  csrfToken,
  visitId,
  patientLabel,
  onSaved,
}: CertificateDrawerProps) {
  const [types, setTypes] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState<CertificateRow | null>(null);
  const [certType, setCertType] = useState('excuse_duty');
  const [restFrom, setRestFrom] = useState('');
  const [restTo, setRestTo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [includeDiagnosis, setIncludeDiagnosis] = useState(false);
  const [diagnosisText, setDiagnosisText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const dirtyRef = useRef(false);

  const applyPayload = useCallback((data: CertificatePayload) => {
    setTypes(data.types ?? {});
    setCurrent(data.certificate);
    setLocked(!!data.locked);
    if (!dirtyRef.current) {
      const cert = data.certificate;
      setCertType(cert?.cert_type ?? 'excuse_duty');
      setRestFrom(cert?.rest_from ?? '');
      setRestTo(cert?.rest_to ?? '');
      setRemarks(cert?.remarks ?? '');
      setIncludeDiagnosis(!!cert?.include_diagnosis);
      setDiagnosisText(cert?.diagnosis_text ?? '');
    }
  }, []);

  useEffect(() => {
    if (!open || !visitId) return;
    let cancelled = false;
    dirtyRef.current = false;
    setError(null);

    const cached = certCache.get(visitId);
    if (cached) {
      applyPayload(cached);
      setLoading(false);
    } else {
      setLoading(true);
      setCurrent(null);
    }

    let request = inflightGets.get(visitId);
    if (!request) {
      request = oeFetch<CertificatePayload>('clinical_doc.certificate_get', {
        ajaxUrl,
        csrfToken,
        params: { visit_id: visitId },
      });
      inflightGets.set(visitId, request);
      void request.catch(() => undefined).then(() => inflightGets.delete(visitId));
    }

    (async () => {
      try {
        const data = await request;
        certCache.set(visitId, data);
        if (cancelled) return;
        applyPayload(data);
      } catch (err) {
        if (!cancelled && !certCache.get(visitId)) {
          setError(err instanceof Error ? err.message : 'Could not load the certificate.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, visitId, ajaxUrl, csrfToken, applyPayload]);

  const needsRest = REST_TYPES.includes(certType);
  const restInvalid = needsRest && (!restFrom || !restTo || restTo < restFrom);

  // Typing "3" in the days box fills the end date from the start date.
  const setDays = useCallback((raw: string) => {
    dirtyRef.current = true;
    const days = Number.parseInt(raw, 10);
    if (!Number.isFinite(days) || days <= 0 || !restFrom) return;
    const from = new Date(`${restFrom}T00:00:00`);
    from.setDate(from.getDate() + (days - 1));
    // Format in LOCAL time — toISOString() is UTC and shifts the date by a day
    // in negative-offset timezones.
    const y = from.getFullYear();
    const m = String(from.getMonth() + 1).padStart(2, '0');
    const d = String(from.getDate()).padStart(2, '0');
    setRestTo(`${y}-${m}-${d}`);
  }, [restFrom]);

  const printedAlready = (current?.print_count ?? 0) > 0;

  const save = useCallback(async () => {
    if (!visitId || restInvalid) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await oeFetch<CertificateRow & { superseded?: boolean }>('clinical_doc.certificate_save', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          visit_id: visitId,
          cert_type: certType,
          rest_from: needsRest ? restFrom : '',
          rest_to: needsRest ? restTo : '',
          remarks,
          include_diagnosis: includeDiagnosis,
          diagnosis_text: includeDiagnosis ? diagnosisText : '',
        },
      });
      certCache.delete(visitId);
      showDeskToast(
        saved.superseded
          ? `New certificate ${saved.cert_no} issued — the printed one is marked superseded`
          : `Certificate ${saved.cert_no} saved`,
        'success',
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the certificate.');
    } finally {
      setSaving(false);
    }
  }, [visitId, certType, needsRest, restFrom, restTo, remarks, includeDiagnosis, diagnosisText, restInvalid, ajaxUrl, csrfToken, onSaved]);

  const markDirty = () => { dirtyRef.current = true; };

  const typeOptions = useMemo(() => Object.entries(types), [types]);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      dismissOnOutsideClick={false}
      title="Medical certificate"
      id="nc-certificate-editor"
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!current || !visitId}
            title={current ? 'Print the certificate' : 'Save a certificate first'}
            onClick={() => {
              window.open(`certificate-print.php?visit_id=${visitId}`, '_blank', 'noopener');
            }}
          >
            Print
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void save();
              }}
              disabled={saving || loading || locked || restInvalid}
            >
              {saving ? 'Saving…' : printedAlready ? 'Issue new certificate' : 'Save certificate'}
            </Button>
          </div>
        </div>
      )}
    >
      {patientLabel && (
        <p className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">{patientLabel}</p>
      )}

      {error && <div className={deskCalloutClass('error', 'mb-3 py-2 text-sm')}>{error}</div>}
      {locked && (
        <div className={deskCalloutClass('info', 'mb-3 py-2 text-sm')}>
          This certificate is signed — read only. Unlock the encounter to amend it.
        </div>
      )}
      {current && (
        <div className={deskCalloutClass('info', 'mb-3 py-2 text-sm')}>
          Current certificate <strong>{current.cert_no}</strong>
          {printedAlready
            ? ` — printed ${current.print_count}×. Saving changes issues a NEW number and marks this one superseded.`
            : ' — not printed yet; changes keep this number.'}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading certificate…</p>
      ) : (
        <div className="space-y-4">
          <fieldset className="nc-scrn-item">
            <legend className="nc-scrn-question"><span className="nc-scrn-question-text">Certificate type</span></legend>
            <div className="nc-scrn-options">
              {typeOptions.map(([value, label]) => (
                <label key={value} className={`nc-scrn-option${certType === value ? ' is-selected' : ''}`}>
                  <input
                    className="nc-scrn-option-input"
                    type="radio"
                    name="nc-cert-type"
                    value={value}
                    checked={certType === value}
                    onChange={() => { markDirty(); setCertType(value); }}
                    disabled={locked}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {needsRest && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-cert-from">Rest from</Label>
                <Input
                  id="nc-cert-from"
                  type="date"
                  value={restFrom}
                  onChange={(e) => { markDirty(); setRestFrom(e.target.value); }}
                  disabled={locked}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-cert-to">Rest to</Label>
                <Input
                  id="nc-cert-to"
                  type="date"
                  value={restTo}
                  onChange={(e) => { markDirty(); setRestTo(e.target.value); }}
                  aria-invalid={restInvalid ? true : undefined}
                  disabled={locked}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-cert-days">Days</Label>
                <Input
                  id="nc-cert-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="e.g. 3"
                  onChange={(e) => setDays(e.target.value)}
                  disabled={locked || !restFrom}
                />
              </div>
            </div>
          )}
          {restInvalid && restFrom && restTo && (
            <p className="m-0 text-xs text-[var(--oe-nc-danger)]">The end date must not be before the start date.</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nc-cert-remarks">Remarks (optional)</Label>
            <Textarea
              id="nc-cert-remarks"
              rows={2}
              value={remarks}
              onChange={(e) => { markDirty(); setRemarks(e.target.value); }}
              placeholder="e.g. Light duties for one week"
              disabled={locked}
            />
          </div>

          <div className="space-y-1.5">
            <label className="inline-flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeDiagnosis}
                onChange={(e) => { markDirty(); setIncludeDiagnosis(e.target.checked); }}
                disabled={locked}
              />
              <span>
                Include diagnosis on the certificate
                <span className="block text-xs text-[var(--oe-nc-text-muted)]">
                  Off by default — an employer is entitled to “unfit for work”, not the illness. Tick only with the patient’s consent.
                </span>
              </span>
            </label>
            {includeDiagnosis && (
              <Input
                value={diagnosisText}
                onChange={(e) => { markDirty(); setDiagnosisText(e.target.value); }}
                placeholder="Diagnosis as it should appear"
                aria-label="Diagnosis text"
                disabled={locked}
              />
            )}
          </div>
        </div>
      )}
    </SlideOver>
  );
}
