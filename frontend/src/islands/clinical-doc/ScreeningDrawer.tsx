import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Button } from '@components/ui/button';

interface InstrumentOption {
  value: number;
  label: string;
}

interface InstrumentBand {
  min: number;
  max: number;
  severity: string;
  label: string;
}

interface FlagRule {
  item: number;
  min_value: number;
  flag: string;
  message: string;
}

interface InstrumentDef {
  id: string;
  title: string;
  subtitle: string;
  stem: string;
  options: InstrumentOption[];
  max_score: number;
  items: string[];
  bands: InstrumentBand[];
  flag_rules: FlagRule[];
}

interface ScreeningPayload {
  instrument: InstrumentDef;
  answers: Record<string, number>;
  saved: boolean;
  locked?: boolean;
}

interface ScreeningDrawerProps {
  open: boolean;
  onClose: () => void;
  ajaxUrl: string;
  csrfToken: string;
  visitId: number | null;
  instrument: string | null;
  patientLabel: string;
  onSaved: () => void;
}

// Every PHP request serializes ~0.5s on the session lock during bootstrap, so
// rapid drawer open/close cycles used to queue a flood of identical GETs and the
// next open sat on "Loading…" behind them with the modal blocking the page (the
// screening-tab freeze). Instrument definitions are static and answers only
// change through this drawer, so: cache both for instant reopens, and keep at
// most ONE request in flight per (visit, instrument) — extra opens reuse it.
const instrumentDefCache = new Map<string, InstrumentDef>();
const answersCache = new Map<string, Record<string, number>>();
const lockedCache = new Map<string, boolean>();
const inflightGets = new Map<string, Promise<ScreeningPayload>>();

/** Test hook — module-level caches would otherwise leak between test cases. */
export function clearScreeningCachesForTest(): void {
  instrumentDefCache.clear();
  answersCache.clear();
  lockedCache.clear();
  inflightGets.clear();
}

/**
 * Native screening questionnaire drawer (PHQ-9 / GAD-7). Fetches the instrument
 * definition + any saved answers, renders one radio row per question, computes the
 * score and severity live, raises a safety alert for flagged answers (PHQ-9 item
 * 9), and saves to the visit. The server re-scores on save — the client number is
 * for feedback only.
 */
export function ScreeningDrawer({
  open,
  onClose,
  ajaxUrl,
  csrfToken,
  visitId,
  instrument,
  patientLabel,
  onSaved,
}: ScreeningDrawerProps) {
  const [def, setDef] = useState<InstrumentDef | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  // True once the user changes an answer in this open — a background refresh
  // must never overwrite what they are typing.
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!open || !visitId || !instrument) return;
    let cancelled = false;
    const cacheKey = `${visitId}:${instrument}`;
    dirtyRef.current = false;
    setError(null);

    const cachedDef = instrumentDefCache.get(instrument);
    if (cachedDef) {
      // Instant render from cache; the fetch below revalidates in the background.
      setDef(cachedDef);
      setAnswers(answersCache.get(cacheKey) ?? {});
      setLocked(lockedCache.get(cacheKey) ?? false);
      setLoading(false);
    } else {
      setLoading(true);
      setDef(null);
      setAnswers({});
    }

    let request = inflightGets.get(cacheKey);
    if (!request) {
      request = oeFetch<ScreeningPayload>('clinical_doc.screening_get', {
        ajaxUrl,
        csrfToken,
        params: { visit_id: visitId, instrument },
      });
      inflightGets.set(cacheKey, request);
      void request.catch(() => undefined).then(() => inflightGets.delete(cacheKey));
    }

    (async () => {
      try {
        const data = await request;
        instrumentDefCache.set(instrument, data.instrument);
        answersCache.set(cacheKey, data.answers ?? {});
        lockedCache.set(cacheKey, !!data.locked);
        if (cancelled) return;
        setDef(data.instrument);
        setLocked(!!data.locked);
        if (!dirtyRef.current) {
          setAnswers(data.answers ?? {});
        }
      } catch (err) {
        if (!cancelled && !instrumentDefCache.get(instrument)) {
          setError(err instanceof Error ? err.message : 'Could not load the screener.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, visitId, instrument, ajaxUrl, csrfToken]);

  const setAnswer = useCallback((itemIndex: number, value: number) => {
    dirtyRef.current = true;
    setAnswers((prev) => ({ ...prev, [String(itemIndex)]: value }));
  }, []);

  const { total, answeredCount, severityLabel, severityTone, flags, complete } = useMemo(() => {
    if (!def) {
      return { total: 0, answeredCount: 0, severityLabel: '', severityTone: 'low', flags: [] as FlagRule[], complete: false };
    }
    let sum = 0;
    let answered = 0;
    def.items.forEach((_, idx) => {
      const key = String(idx + 1);
      if (key in answers) {
        sum += answers[key];
        answered += 1;
      }
    });
    const band = def.bands.find((b) => sum >= b.min && sum <= b.max);
    const firedFlags = def.flag_rules.filter((rule) => (answers[String(rule.item)] ?? 0) >= rule.min_value);
    const toneMap: Record<string, string> = {
      minimal: 'low',
      mild: 'mid',
      moderate: 'mid',
      moderately_severe: 'high',
      severe: 'high',
    };
    return {
      total: sum,
      answeredCount: answered,
      severityLabel: band?.label ?? '',
      severityTone: toneMap[band?.severity ?? ''] ?? 'low',
      flags: firedFlags,
      complete: answered === def.items.length,
    };
  }, [def, answers]);

  const save = useCallback(async () => {
    if (!visitId || !instrument || !complete) return;
    setSaving(true);
    setError(null);
    try {
      await oeFetch('clinical_doc.screening_save', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId, instrument, answers },
      });
      answersCache.set(`${visitId}:${instrument}`, answers);
      showDeskToast('Screening saved', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the screener.');
    } finally {
      setSaving(false);
    }
  }, [visitId, instrument, complete, answers, ajaxUrl, csrfToken, onSaved]);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      dismissOnOutsideClick={false}
      title={def ? `${def.title} — ${def.subtitle}` : 'Screening'}
      id="nc-screening-editor"
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="nc-scrn-result" aria-live="polite">
            {def ? (
              <>
                <span className="nc-scrn-score">{total} / {def.max_score}</span>
                {severityLabel ? (
                  <span className={`nc-scrn-sev nc-scrn-sev--${severityTone}`}>{severityLabel}</span>
                ) : null}
                <span className="nc-scrn-progress">{answeredCount}/{def.items.length} answered</span>
              </>
            ) : null}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void save();
              }}
              disabled={saving || loading || locked || !complete}
            >
              {saving ? 'Saving…' : 'Save screening'}
            </Button>
          </div>
        </div>
      )}
    >
      {patientLabel && (
        <p className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">{patientLabel}</p>
      )}

      {error && <div className={deskCalloutClass('error', 'mb-3 py-2 text-sm')}>{error}</div>}

      {loading || !def ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading screener…</p>
      ) : (
        <div>
          <p className="nc-scrn-stem">{def.stem}</p>

          {locked && (
            <div className={deskCalloutClass('info', 'mb-4 py-2 text-sm')}>
              This screening is signed — read only. Unlock the encounter to amend it.
            </div>
          )}

          {flags.length > 0 && (
            <div className={deskCalloutClass('error', 'mb-4 py-2 text-sm')} role="alert">
              {flags.map((f) => (
                <p key={f.flag} className="m-0">{f.message}</p>
              ))}
            </div>
          )}

          {def.items.map((item, idx) => {
            const key = String(idx + 1);
            const answered = key in answers;
            return (
              <fieldset key={key} className="nc-scrn-item">
                <legend className="nc-scrn-question">
                  <span className={`nc-scrn-qnum${answered ? ' is-answered' : ''}`} aria-hidden="true">
                    {idx + 1}
                  </span>
                  <span className="nc-scrn-question-text">{item}</span>
                </legend>
                <div className="nc-scrn-options">
                  {def.options.map((opt) => {
                    const selected = answers[key] === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`nc-scrn-option${selected ? ' is-selected' : ''}`}
                      >
                        <input
                          className="nc-scrn-option-input"
                          type="radio"
                          name={`nc-scrn-${key}`}
                          value={opt.value}
                          checked={selected}
                          onChange={() => setAnswer(idx + 1, opt.value)}
                          disabled={locked}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}
    </SlideOver>
  );
}
