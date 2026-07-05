import { useCallback, useEffect, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { oeFetch } from '@core/oeFetch';
import type { ExportBuilderData, ExportGenerateResult, ExportIncludeOption } from './chartDepthTypes';

interface ExportPaneProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  initialPreset?: string;
  initialEncounterId?: number;
}

function submitHiddenForm(postUrl: string, fields: Record<string, string>): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = postUrl;
  form.target = '_blank';
  form.style.display = 'none';

  Object.entries(fields).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

function IncludeOptions({
  options,
  values,
  onChange,
}: {
  options: ExportIncludeOption[];
  values: Record<string, boolean>;
  onChange: (key: string, checked: boolean) => void;
}) {
  const visible = options.filter((opt) => !opt.hidden);
  if (!visible.length) return null;

  return (
    <div className="mb-3">
      <div className="font-bold mb-2">Include</div>
      {visible.map((opt) => (
        <div key={opt.key} className="flex items-center gap-2 mb-2">
          <Checkbox
            id={`nc-export-inc-${opt.key}`}
            checked={values[opt.key] ?? !!opt.checked}
            onCheckedChange={(checked) => onChange(opt.key, checked === true)}
          />
          <Label htmlFor={`nc-export-inc-${opt.key}`} className="font-normal normal-case cursor-pointer mb-0">
            {opt.label}
          </Label>
        </div>
      ))}
    </div>
  );
}

export function ExportPane({ ajaxUrl, csrfToken, pid, initialPreset, initialEncounterId }: ExportPaneProps) {
  const [data, setData] = useState<ExportBuilderData | null>(null);
  const [preset, setPreset] = useState(initialPreset ?? '');
  const [encounterId, setEncounterId] = useState(
    initialEncounterId && initialEncounterId > 0 ? String(initialEncounterId) : ''
  );
  const [includes, setIncludes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const loadBuilder = useCallback(
    async (nextPreset: string, nextEncounterId: string) => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = { pid };
        if (nextPreset) params.preset = nextPreset;
        if (nextEncounterId) params.encounter_id = nextEncounterId;

        const builder = await oeFetch<ExportBuilderData>('chart_depth.export_builder', {
          ...fetchOptions,
          params,
        });
        setData(builder);
        setPreset(builder.selected_preset ?? nextPreset);
        setEncounterId(
          builder.selected_encounter_id != null && builder.selected_encounter_id !== ''
            ? String(builder.selected_encounter_id)
            : nextEncounterId
        );

        const nextIncludes: Record<string, boolean> = {};
        (builder.include_options ?? []).forEach((opt) => {
          nextIncludes[opt.key] = !!opt.checked;
        });
        setIncludes(nextIncludes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load export builder.');
      } finally {
        setLoading(false);
      }
    },
    [fetchOptions, pid]
  );

  useEffect(() => {
    void loadBuilder(initialPreset ?? '', initialEncounterId ? String(initialEncounterId) : '');
  }, [initialEncounterId, initialPreset, loadBuilder]);

  const handleGenerate = async () => {
    if (!data) return;

    if (preset === 'custom') {
      if (data.stock_report_url) {
        window.open(data.stock_report_url, '_top');
      }
      return;
    }

    setGenerating(true);
    try {
      const result = await oeFetch<ExportGenerateResult>('chart_depth.export_generate', {
        ...fetchOptions,
        method: 'POST',
        json: {
          pid,
          preset,
          encounter_id: parseInt(encounterId, 10) || 0,
          include: includes,
        },
      });
      submitHiddenForm(result.post_url, result.fields ?? {});
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading && !data) {
    return <em>Loading export options…</em>;
  }

  if (error) {
    return <div className={deskCalloutClass('error')}>{error}</div>;
  }

  if (!data) return null;

  const canGenerate = !!(data.can_generate && data.has_pat_rep_acl);

  return (
    <div id="nc-export-builder">

      {!data.has_pat_rep_acl && (
        <div className={deskCalloutClass('warn', 'py-2 text-sm')}>
          Your account also needs core Patient Report permission to generate PDFs.
        </div>
      )}

      <div className="space-y-1.5 mb-3">
        <Label htmlFor="nc-export-preset">Preset</Label>
        <Select
          value={preset}
          onValueChange={(next) => {
            setPreset(next);
            void loadBuilder(next, encounterId);
          }}
        >
          <SelectTrigger id="nc-export-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(data.presets ?? []).map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.requires_encounter && (
        <div className="space-y-1.5 mb-3">
          <Label htmlFor="nc-export-encounter">Encounter</Label>
          <Select
            value={encounterId || '_empty'}
            onValueChange={(next) => {
              const resolved = next === '_empty' ? '' : next;
              setEncounterId(resolved);
              void loadBuilder(preset, resolved);
            }}
          >
            <SelectTrigger id="nc-export-encounter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(data.encounters ?? []).length === 0 ? (
                <SelectItem value="_empty">No encounters on file</SelectItem>
              ) : (
                (data.encounters ?? []).map((enc) => (
                  <SelectItem key={enc.encounter_id} value={String(enc.encounter_id)}>
                    {enc.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <IncludeOptions
        options={data.include_options ?? []}
        values={includes}
        onChange={(key, checked) => {
          setIncludes((prev) => ({ ...prev, [key]: checked }));
        }}
      />

      {preset === 'custom' && (
        <div className={deskCalloutClass('info', 'py-2 text-sm')}>
          Custom export opens the stock patient report page.{' '}
          {data.stock_report_url && (
            <a href={data.stock_report_url} target="_top">
              Open stock report
            </a>
          )}
        </div>
      )}

      <div className="border rounded p-3 bg-[var(--oe-nc-bg-tint)] mb-3 text-sm" id="nc-export-confirm">
        {data.confirm_label ?? ''}
      </div>

      <div className="flex flex-wrap">
        <Button
          type="button"
          className="mr-2 mb-2"
          id="nc-export-generate"
          disabled={!canGenerate || generating}
          onClick={() => {
            void handleGenerate();
          }}
        >
          Generate PDF
        </Button>
        {data.employer_letter_url && (
          <Button variant="outline" className="mb-2" asChild>
            <a href={data.employer_letter_url} target="_top">
              Employer / school letter
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
