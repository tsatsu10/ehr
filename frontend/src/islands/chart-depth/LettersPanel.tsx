import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { oeFetch } from '@core/oeFetch';
import type {
  LetterContactOption,
  LetterRenderResult,
  LettersTemplatesData,
  LetterTemplateOption,
} from './chartDepthTypes';

interface LettersPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  letterPrintUrl: string;
}

/**
 * GAP-A A4 — referral letter composer. Templates are the STOCK flat-file
 * letter templates (same directory and {TOKEN} vocabulary as the legacy
 * letter screen); recipients come from the A3 address-book directory.
 */
export function LettersPanel({ ajaxUrl, csrfToken, pid, letterPrintUrl }: LettersPanelProps) {
  const [templates, setTemplates] = useState<LetterTemplateOption[]>([]);
  const [contacts, setContacts] = useState<LetterContactOption[]>([]);
  const [template, setTemplate] = useState('');
  const [toContactId, setToContactId] = useState(0);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printFormRef = useRef<HTMLFormElement>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await oeFetch<LettersTemplatesData>('letters.templates', {
          ...fetchOptions,
          params: { pid },
        });
        if (cancelled) return;
        setTemplates(data.templates ?? []);
        setContacts(data.contacts ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load letter templates.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchOptions, pid]);

  const fillFromTemplate = useCallback(async () => {
    if (!template) {
      setError('Pick a template first.');
      return;
    }
    setRendering(true);
    setError(null);
    try {
      const result = await oeFetch<LetterRenderResult>('letters.render', {
        method: 'POST',
        ...fetchOptions,
        json: { pid, template, to_contact_id: toContactId },
      });
      setBody(result.body ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fill the letter.');
    } finally {
      setRendering(false);
    }
  }, [fetchOptions, pid, template, toContactId]);

  const handlePrint = useCallback(() => {
    if (!body.trim()) {
      setError('The letter body is empty — fill from a template or type the letter first.');
      return;
    }
    setError(null);
    printFormRef.current?.submit();
  }, [body]);

  if (loading) {
    return <p className="text-[var(--oe-nc-text-muted)]">Loading letter templates…</p>;
  }

  return (
    <div className="nc-letters-panel space-y-3" data-testid="nc-letters-panel">
      {error && <div className={deskCalloutClass('error')}>{error}</div>}

      {templates.length === 0 ? (
        <div className={deskCalloutClass('info')}>
          No letter templates found. Templates live in the clinic&apos;s letter_templates folder —
          create them on the legacy letter screen or ask your administrator to add them.
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-letter-template">Template</Label>
            <NativeSelect
              id="nc-letter-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option value="">Choose…</option>
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-letter-to">To (directory contact)</Label>
            <NativeSelect
              id="nc-letter-to"
              value={String(toContactId)}
              onChange={(e) => setToContactId(Number.parseInt(e.target.value, 10) || 0)}
            >
              <option value="0">None</option>
              {contacts.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rendering || !template}
            onClick={() => {
              void fillFromTemplate();
            }}
          >
            {rendering ? 'Filling…' : 'Fill from template'}
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="nc-letter-body">Letter body</Label>
        <textarea
          id="nc-letter-body"
          className="w-full min-h-[16rem] rounded border border-[var(--oe-nc-border)] p-2 font-serif text-[0.95rem] leading-relaxed"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Fill from a template above, then adjust the wording before printing."
        />
      </div>

      <div>
        <Button type="button" variant="cta" size="sm" disabled={!body.trim()} onClick={handlePrint}>
          Print letter
        </Button>
      </div>

      {/* Plain form POST (stock letter.php parity) — the print view is a Twig page, not ajax. */}
      <form
        ref={printFormRef}
        action={letterPrintUrl}
        method="post"
        target="_blank"
        className="hidden"
        aria-hidden="true"
      >
        <input type="hidden" name="csrf_token_form" value={csrfToken} />
        <input type="hidden" name="pid" value={String(pid)} />
        <input type="hidden" name="print" value="1" />
        {/* textarea (not hidden input) so newlines survive the POST intact */}
        <textarea name="body" value={body} readOnly tabIndex={-1} />
      </form>
    </div>
  );
}
