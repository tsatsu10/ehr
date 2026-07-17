import { useCallback, useEffect, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { oeFetch } from '@core/oeFetch';
import { AdminInsetPanel } from '../adminUi';

interface ProviderColorRow {
  id: number;
  label: string;
  color: string;
  is_custom: boolean;
  default_color: string;
}

interface ProviderColorsPayload {
  facility_id: number;
  providers: ProviderColorRow[];
}

interface ProviderColorsPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  schedulingEnabled: boolean;
}

export function ProviderColorsPanel({
  ajaxUrl,
  csrfToken,
  facilityId,
  schedulingEnabled,
}: ProviderColorsPanelProps) {
  const [rows, setRows] = useState<ProviderColorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schedulingEnabled || facilityId <= 0) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await oeFetch<ProviderColorsPayload>('scheduling.provider_colors', {
        ajaxUrl,
        csrfToken,
        params: { facility_id: facilityId },
      });
      setRows(data.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load provider colors');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityId, schedulingEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const setColor = (id: number, color: string) => {
    setRows((prev) => prev.map((row) => (
      row.id === id ? { ...row, color, is_custom: color.toLowerCase() !== row.default_color.toLowerCase() } : row
    )));
  };

  const resetColor = (id: number) => {
    setRows((prev) => prev.map((row) => (
      row.id === id ? { ...row, color: row.default_color, is_custom: false } : row
    )));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const colors: Record<number, string> = {};
      rows.forEach((row) => { colors[row.id] = row.color; });
      const data = await oeFetch<ProviderColorsPayload>('scheduling.provider_colors.save', {
        method: 'POST',
        ajaxUrl,
        csrfToken,
        json: { facility_id: facilityId, colors },
      });
      setRows(data.providers);
      setSuccess('Provider colors saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save provider colors');
    } finally {
      setSaving(false);
    }
  };

  if (!schedulingEnabled) {
    return null;
  }

  return (
    <AdminInsetPanel className="mt-2" id="nc-admin-provider-colors">
      <h6 className="mb-1">Provider calendar colors</h6>
      <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
        Color each provider on the multi-provider Day and Week calendars. Sensible defaults are
        applied automatically; pick your own or reset any provider to its default.
      </p>
      {error && <div className={deskCalloutClass('error', 'py-2 text-sm')}>{error}</div>}
      {success && <div className={deskCalloutClass('success', 'py-2 text-sm')}>{success}</div>}
      {loading ? (
        <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">Loading provider colors…</p>
      ) : rows.length === 0 ? (
        <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">
          No calendar providers found for this facility.
        </p>
      ) : (
        <>
          <ul className="nc-provider-color-list" role="list">
            {rows.map((row) => (
              <li key={row.id} className="nc-provider-color-row">
                <input
                  type="color"
                  className="nc-provider-color-swatch"
                  aria-label={`Color for ${row.label}`}
                  value={row.color}
                  onChange={(e) => setColor(row.id, e.target.value)}
                />
                <span className="nc-provider-color-name">{row.label}</span>
                {row.is_custom ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => resetColor(row.id)}
                  >
                    Reset
                  </Button>
                ) : (
                  <span className="text-[var(--oe-nc-text-muted)] text-sm">Default</span>
                )}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            disabled={saving}
            onClick={() => { void handleSave(); }}
          >
            {saving ? 'Saving…' : 'Save provider colors'}
          </Button>
        </>
      )}
    </AdminInsetPanel>
  );
}
