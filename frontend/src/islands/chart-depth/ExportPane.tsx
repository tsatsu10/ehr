import { useCallback, useEffect, useMemo, useState } from 'react';
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
      <div className="font-weight-bold mb-2">Include</div>
      {visible.map((opt) => (
        <div key={opt.key} className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            id={`nc-export-inc-${opt.key}`}
            checked={values[opt.key] ?? !!opt.checked}
            onChange={(e) => onChange(opt.key, e.target.checked)}
          />
          <label className="form-check-label" htmlFor={`nc-export-inc-${opt.key}`}>
            {opt.label}
          </label>
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
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!data) return null;

  const patient = data.patient ?? {};
  const canGenerate = !!(data.can_generate && data.has_pat_rep_acl);

  return (
    <div id="nc-export-builder">
      <div className="mb-2">
        <strong>{patient.name ?? 'Patient'}</strong>
        {patient.pubpid ? ` · MRN ${patient.pubpid}` : ''}
      </div>

      {!data.has_pat_rep_acl && (
        <div className="alert alert-warning py-2 small">
          Your account also needs core Patient Report permission to generate PDFs.
        </div>
      )}

      <div className="form-group">
        <label htmlFor="nc-export-preset">Preset</label>
        <select
          className="form-control"
          id="nc-export-preset"
          value={preset}
          onChange={(e) => {
            const next = e.target.value;
            setPreset(next);
            void loadBuilder(next, encounterId);
          }}
        >
          {(data.presets ?? []).map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {data.requires_encounter && (
        <div className="form-group">
          <label htmlFor="nc-export-encounter">Encounter</label>
          <select
            className="form-control"
            id="nc-export-encounter"
            value={encounterId}
            onChange={(e) => {
              const next = e.target.value;
              setEncounterId(next);
              void loadBuilder(preset, next);
            }}
          >
            {(data.encounters ?? []).length === 0 ? (
              <option value="">No encounters on file</option>
            ) : (
              (data.encounters ?? []).map((enc) => (
                <option key={enc.encounter_id} value={String(enc.encounter_id)}>
                  {enc.label}
                </option>
              ))
            )}
          </select>
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
        <div className="alert alert-info py-2 small">
          Custom export opens the stock patient report page.{' '}
          {data.stock_report_url && (
            <a href={data.stock_report_url} target="_top">
              Open stock report
            </a>
          )}
        </div>
      )}

      <div className="border rounded p-3 bg-light mb-3 small" id="nc-export-confirm">
        {data.confirm_label ?? ''}
      </div>

      <div className="d-flex flex-wrap">
        <button
          type="button"
          className="btn btn-primary mr-2 mb-2"
          id="nc-export-generate"
          disabled={!canGenerate || generating}
          onClick={() => {
            void handleGenerate();
          }}
        >
          Generate PDF
        </button>
        {data.employer_letter_url && (
          <a className="btn btn-outline-secondary mb-2" href={data.employer_letter_url} target="_top">
            Employer / school letter
          </a>
        )}
      </div>
    </div>
  );
}
