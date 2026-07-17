import { useCallback, useEffect, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';

interface InstructionsPayload {
  enabled: boolean;
  visit_id: number;
  form_id: number | null;
  instruction: string;
  locked?: boolean;
  snippets: string[];
}

interface ClinicalInstructionsDrawerProps {
  open: boolean;
  onClose: () => void;
  ajaxUrl: string;
  csrfToken: string;
  visitId: number | null;
  patientLabel: string;
  onSaved: () => void;
}

// Same anti-flood pattern as ScreeningDrawer: every PHP request serializes
// ~0.5s on the session lock during bootstrap, so rapid open/close cycles used to
// queue identical GETs and the next open sat on "Loading…" behind them. Cache
// the payload per visit for instant reopens and keep at most one GET in flight.
const instructionsCache = new Map<number, InstructionsPayload>();
const inflightGets = new Map<number, Promise<InstructionsPayload>>();

/** Test hook — module-level caches would otherwise leak between test cases. */
export function clearInstructionsCachesForTest(): void {
  instructionsCache.clear();
  inflightGets.clear();
}

/**
 * Native Clinical Instructions editor — the default editor for the
 * clinical_instructions encounter form (no feature flag). One free-text note plus
 * quick-insert snippet chips; writes the same form_clinical_instructions row so
 * the note stays visible everywhere OpenEMR reads the stock form.
 */
export function ClinicalInstructionsDrawer({
  open,
  onClose,
  ajaxUrl,
  csrfToken,
  visitId,
  patientLabel,
  onSaved,
}: ClinicalInstructionsDrawerProps) {
  const [instruction, setInstruction] = useState('');
  const [snippets, setSnippets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only show the empty-field hint after the user has interacted — an error on
  // a untouched fresh form is noise.
  const [touched, setTouched] = useState(false);
  const [locked, setLocked] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  // True once the user edits in this open — a background refresh must never
  // overwrite what they are typing.
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!open || !visitId) return;
    let cancelled = false;
    dirtyRef.current = false;
    setTouched(false);
    setError(null);

    const cached = instructionsCache.get(visitId);
    if (cached) {
      // Instant render from cache; the fetch below revalidates in the background.
      setInstruction(cached.instruction ?? '');
      setSnippets(cached.snippets ?? []);
      setLocked(!!cached.locked);
      setHasSaved(cached.form_id != null);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let request = inflightGets.get(visitId);
    if (!request) {
      request = oeFetch<InstructionsPayload>('clinical_doc.instructions_get', {
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
        instructionsCache.set(visitId, data);
        if (cancelled) return;
        setSnippets(data.snippets ?? []);
        setLocked(!!data.locked);
        setHasSaved(data.form_id != null);
        if (!dirtyRef.current) {
          setInstruction(data.instruction ?? '');
        }
      } catch (err) {
        if (!cancelled && !instructionsCache.get(visitId)) {
          setError(err instanceof Error ? err.message : 'Could not load the instructions.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, visitId, ajaxUrl, csrfToken]);

  const appendSnippet = useCallback((text: string) => {
    dirtyRef.current = true;
    setInstruction((prev) => {
      const trimmed = prev.trimEnd();
      if (trimmed === '') return text;
      return `${trimmed}\n${text}`;
    });
  }, []);

  const empty = instruction.trim() === '';

  const save = useCallback(async () => {
    if (!visitId || empty) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await oeFetch<{ form_id: number }>('clinical_doc.instructions_save', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId, instruction },
      });
      const cached = instructionsCache.get(visitId);
      if (cached) {
        instructionsCache.set(visitId, { ...cached, instruction, form_id: saved.form_id ?? cached.form_id });
      }
      setHasSaved(true);
      showDeskToast('Instructions saved', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the instructions.');
    } finally {
      setSaving(false);
    }
  }, [visitId, instruction, empty, ajaxUrl, csrfToken, onSaved]);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      dismissOnOutsideClick={false}
      title="Clinical instructions"
      id="nc-clinical-instructions-editor"
      initialFocusSelector="#nc-clinical-instructions-text"
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!hasSaved || !visitId}
            title={hasSaved ? 'Print the saved instructions for the patient' : 'Save the instructions first'}
            onClick={() => {
              // Relative to clinical-doc/index.php — opens the printable handout.
              window.open(`instructions-print.php?visit_id=${visitId}`, '_blank', 'noopener');
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
              disabled={saving || loading || locked || empty}
            >
              {saving ? 'Saving…' : 'Save instructions'}
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
          These instructions are signed — read only. Unlock the encounter to amend them.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading instructions…</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-clinical-instructions-text">Instructions / patient education</Label>
            <Textarea
              id="nc-clinical-instructions-text"
              rows={8}
              value={instruction}
              onChange={(e) => {
                dirtyRef.current = true;
                setTouched(true);
                setInstruction(e.target.value);
              }}
              aria-invalid={empty && touched ? true : undefined}
              placeholder="What the patient should do after this visit…"
              disabled={locked}
            />
            {empty && touched && (
              <p className="m-0 text-xs text-[var(--oe-nc-danger)]">Enter at least one instruction.</p>
            )}
          </div>

          {snippets.length > 0 && (
            <div className="space-y-1.5">
              <p className="m-0 text-xs font-medium text-[var(--oe-nc-text-muted)]">Quick insert</p>
              <div className="flex flex-wrap gap-2">
                {snippets.map((text) => (
                  <Button
                    key={text}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendSnippet(text)}
                    disabled={locked}
                  >
                    {text}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
}
