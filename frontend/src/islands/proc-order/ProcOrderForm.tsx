import { useCallback, useEffect, useMemo, useState } from 'react';
import { Beaker, ClipboardList, FlaskConical, Loader2, Syringe, Zap } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Checkbox } from '@components/ui/checkbox';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';
import { SegmentedControl } from '@components/SegmentedControl';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { t } from '@core/i18n';
import { oeFetch } from '@core/oeFetch';
import type {
  ProcOrderFormData,
  ProcOrderProps,
  ProcOrderSaveResult,
  ProcOrderTest,
} from './procOrderTypes';

function formatMoney(symbol: string, amount: number): string {
  return `${symbol}${amount.toFixed(2)}`;
}

export function ProcOrderForm({
  ajaxUrl,
  csrfToken,
  visitId,
  procedureOrderId = 0,
  returnUrl,
}: ProcOrderProps) {
  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const [data, setData] = useState<ProcOrderFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [labId, setLabId] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [priority, setPriority] = useState('normal');
  const [specimenType, setSpecimenType] = useState('');
  const [specimenVolume, setSpecimenVolume] = useState('');
  const [clinicalHx, setClinicalHx] = useState('');
  const [orderDiagnosis, setOrderDiagnosis] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    void oeFetch<ProcOrderFormData>('proc_order.form_data', {
      ...fetchOptions,
      params: { visit_id: String(visitId), procedure_order_id: String(procedureOrderId) },
    })
      .then((payload) => {
        if (!alive) return;
        setData(payload);
        const firstLab = payload.default_lab_id > 0
          ? payload.default_lab_id
          : (payload.labs[0]?.ppid ?? 0);
        const existing = payload.order;
        const initialLab = existing && existing.lab_id > 0 ? existing.lab_id : firstLab;
        setLabId(initialLab);

        const priorities = payload.priority_options.map((p) => p.id);
        setPriority(
          existing && priorities.includes(existing.order_priority)
            ? existing.order_priority
            : priorities.includes('normal') ? 'normal' : (priorities[0] ?? 'normal'),
        );

        if (existing) {
          setSpecimenType(existing.specimen_type);
          setSpecimenVolume(existing.specimen_volume);
          setClinicalHx(existing.clinical_hx);
          setOrderDiagnosis(existing.order_diagnosis);
          const lab = payload.labs.find((l) => l.ppid === initialLab);
          const codes = new Set(existing.codes.map((c) => c.procedure_code));
          const preselected = (lab?.tests ?? [])
            .filter((test) => codes.has(test.code))
            .map((test) => test.procedure_type_id);
          setSelected(new Set(preselected));
        }
      })
      .catch((err) => {
        if (alive) setLoadError(err instanceof Error ? err.message : t('Could not load the order form'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fetchOptions, visitId, procedureOrderId]);

  const activeLab = useMemo(
    () => data?.labs.find((l) => l.ppid === labId) ?? null,
    [data, labId],
  );
  const tests: ProcOrderTest[] = useMemo(() => activeLab?.tests ?? [], [activeLab]);
  const isEdit = procedureOrderId > 0;

  const estimatedTotal = useMemo(() => {
    if (!activeLab?.is_inhouse) return null;
    let total = 0;
    let any = false;
    for (const test of tests) {
      if (selected.has(test.procedure_type_id) && test.fee_amount != null && !Number.isNaN(test.fee_amount)) {
        total += test.fee_amount;
        any = true;
      }
    }
    return any ? total : null;
  }, [activeLab, tests, selected]);

  const changeLab = (nextLab: number) => {
    if (nextLab === labId) return;
    setLabId(nextLab);
    // Tests belong to a lab catalog — a lab switch clears the selection.
    setSelected(new Set());
  };

  const toggleTest = useCallback((id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const submit = async () => {
    if (saving) return;
    const ids = [...selected];
    if (ids.length === 0) {
      setSaveError(t('Select at least one test for the order.'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await oeFetch<ProcOrderSaveResult>('proc_order.save', {
        ...fetchOptions,
        json: {
          visit_id: visitId,
          procedure_order_id: procedureOrderId,
          lab_id: labId,
          order_priority: priority,
          specimen_type: specimenType,
          specimen_volume: specimenVolume,
          clinical_hx: clinicalHx,
          order_diagnosis: orderDiagnosis,
          procedure_type_ids: ids,
        },
      });
      const posted = result.billing?.posted_count ?? 0;
      showDeskToast(
        posted > 0
          ? t('Order saved — {count} charge(s) posted to the visit.', { count: posted })
          : t('Order saved for this visit.'),
        'success',
      );
      window.location.href = returnUrl;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('Could not save the order'));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="nc-proc-order nc-proc-order--status" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>{t('Loading the order form…')}</span>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="nc-proc-order">
        <div className={deskCalloutClass('error')} role="alert">{loadError}</div>
      </div>
    );
  }
  if (!data) return null;

  const selectedCount = selected.size;
  const isUrgentPriority = /urgent|stat|asap/i.test(priority);

  return (
    <div className="nc-proc-order">
      <header className="nc-proc-order__hero">
        <span className="nc-proc-order__hero-icon" aria-hidden="true">
          <FlaskConical className="h-6 w-6" />
        </span>
        <div className="nc-proc-order__hero-text">
          <h2 className="nc-proc-order__title">
            {isEdit ? t('Edit lab / procedure order') : t('New lab / procedure order')}
          </h2>
          {data.patient_name && (
            <p className="nc-proc-order__patient">{data.patient_name}</p>
          )}
        </div>
        {isUrgentPriority && (
          <Badge variant="danger" className="nc-proc-order__hero-badge">
            <Zap className="h-3 w-3" aria-hidden="true" />
            {t('Urgent')}
          </Badge>
        )}
      </header>

      <section className="nc-proc-order__card">
        <div className="nc-proc-order__grid">
          <div className="nc-proc-order__field">
            <Label htmlFor="nc-proc-order-lab" className="nc-proc-order__label">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Lab')}
            </Label>
            <NativeSelect
              id="nc-proc-order-lab"
              value={String(labId)}
              onChange={(e) => changeLab(Number(e.target.value))}
            >
              {data.labs.map((lab) => (
                <option key={lab.ppid} value={lab.ppid}>
                  {lab.is_inhouse ? t('{name} (in-house)', { name: lab.name }) : lab.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="nc-proc-order__field">
            <Label className="nc-proc-order__label">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Priority')}
            </Label>
            <SegmentedControl
              ariaLabel={t('Priority')}
              value={priority}
              onChange={setPriority}
              segments={data.priority_options.map((opt) => ({ id: opt.id, label: opt.title }))}
            />
          </div>
        </div>
      </section>

      <section className="nc-proc-order__card">
        <div className="nc-proc-order__card-head">
          <Beaker className="h-4 w-4" aria-hidden="true" />
          <h3 className="nc-proc-order__card-title">{t('Tests')}</h3>
          {selectedCount > 0 && (
            <Badge variant="info" className="nc-proc-order__test-count">
              {t('{count} selected', { count: selectedCount })}
            </Badge>
          )}
        </div>

        {tests.length === 0 ? (
          <p className={deskCalloutClass('warn', 'nc-proc-order__status')}>
            {t('This lab has no active tests. Choose another lab or add tests in Lab Operations setup.')}
          </p>
        ) : (
          <ul className="nc-proc-order__test-list">
            {tests.map((test) => {
              const isChecked = selected.has(test.procedure_type_id);
              return (
                <li key={test.procedure_type_id}>
                  <label
                    htmlFor={`nc-proc-order-test-${test.procedure_type_id}`}
                    className={`nc-proc-order__test${isChecked ? ' nc-proc-order__test--selected' : ''}`}
                  >
                    <Checkbox
                      id={`nc-proc-order-test-${test.procedure_type_id}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => toggleTest(test.procedure_type_id, checked === true)}
                    />
                    <span className="nc-proc-order__test-name">
                      {test.name}
                      {test.code && <span className="nc-proc-order__test-code">{test.code}</span>}
                    </span>
                    {activeLab?.is_inhouse && (
                      test.has_fee && test.fee_amount != null ? (
                        <Badge variant="outline" className="nc-proc-order__test-fee">
                          {formatMoney(data.currency_symbol, test.fee_amount)}
                        </Badge>
                      ) : (
                        <span className="nc-proc-order__test-fee-missing">{t('no fee mapped')}</span>
                      )
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {estimatedTotal != null && (
          <div className="nc-proc-order__total">
            <span>{t('Estimated total')}</span>
            <strong>{formatMoney(data.currency_symbol, estimatedTotal)}</strong>
          </div>
        )}
      </section>

      <section className="nc-proc-order__card">
        <div className="nc-proc-order__card-head">
          <Syringe className="h-4 w-4" aria-hidden="true" />
          <h3 className="nc-proc-order__card-title">{t('Specimen & clinical details')}</h3>
        </div>

        <div className="nc-proc-order__grid">
          <div className="nc-proc-order__field">
            <Label htmlFor="nc-proc-order-specimen">{t('Specimen type')}</Label>
            <NativeSelect
              id="nc-proc-order-specimen"
              value={specimenType}
              onChange={(e) => setSpecimenType(e.target.value)}
            >
              <option value="">{t('— none —')}</option>
              {data.specimen_options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="nc-proc-order__field">
            <Label htmlFor="nc-proc-order-volume">{t('Specimen volume')}</Label>
            <input
              id="nc-proc-order-volume"
              className="nc-input"
              type="text"
              value={specimenVolume}
              maxLength={30}
              onChange={(e) => setSpecimenVolume(e.target.value)}
            />
          </div>
        </div>

        <div className="nc-proc-order__field">
          <Label htmlFor="nc-proc-order-diagnosis">{t('Order diagnosis')}</Label>
          <input
            id="nc-proc-order-diagnosis"
            className="nc-input"
            type="text"
            value={orderDiagnosis}
            maxLength={255}
            placeholder={t('e.g. ICD10:E11.9 or free text')}
            onChange={(e) => setOrderDiagnosis(e.target.value)}
          />
        </div>

        <div className="nc-proc-order__field">
          <Label htmlFor="nc-proc-order-hx" className="nc-proc-order__label">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Clinical history')}
          </Label>
          <Textarea
            id="nc-proc-order-hx"
            rows={2}
            value={clinicalHx}
            maxLength={255}
            onChange={(e) => setClinicalHx(e.target.value)}
          />
        </div>
      </section>

      {saveError && (
        <div className={deskCalloutClass('error', 'nc-proc-order__status')} role="alert">
          {saveError}
        </div>
      )}

      <div className="nc-proc-order__actions">
        <Button type="button" variant="secondary" onClick={() => { window.location.href = returnUrl; }}>
          {t('Cancel')}
        </Button>
        <Button
          type="button"
          variant="cta"
          disabled={saving || selected.size === 0}
          onClick={() => void submit()}
        >
          {saving ? t('Saving…') : isEdit ? t('Save order') : t('Place order')}
        </Button>
      </div>
    </div>
  );
}
