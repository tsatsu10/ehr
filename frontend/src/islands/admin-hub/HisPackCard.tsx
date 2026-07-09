/**
 * HisPackCard — Ghana OPD Background field pack for the HIS layout (M6-F28).
 *
 * Hides US-centric screening fields on History & Lifestyle and adds a
 * structured sickle-cell family-history field. Idempotent server action.
 */

import { useCallback, useEffect, useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { oeFetch } from '@core/oeFetch';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { AdminSection } from './adminUi';

interface HisPackStatus {
  applied: boolean;
  hidden_count: number;
  sickle_cell_present: boolean;
}

interface HisPackImportResult {
  hidden: string[];
  added: string[];
  already_applied: boolean;
}

interface HisPackCardProps {
  ajaxUrl: string;
  csrfToken: string;
}

export function HisPackCard({ ajaxUrl, csrfToken }: HisPackCardProps) {
  const [status, setStatus] = useState<HisPackStatus | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await oeFetch<HisPackStatus>('admin.his_pack_status', { ajaxUrl, csrfToken });
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, [ajaxUrl, csrfToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleApply = useCallback(async () => {
    setApplying(true);
    setError(null);
    setResultNote(null);
    try {
      const result = await oeFetch<HisPackImportResult>('admin.his_pack_import', {
        method: 'POST',
        ajaxUrl,
        csrfToken,
        json: {},
      });
      setResultNote(
        result.already_applied
          ? 'Pack already applied — nothing to change.'
          : `Applied: ${result.hidden.length} field(s) hidden, ${result.added.length} field(s) added.`,
      );
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply the pack');
    } finally {
      setApplying(false);
    }
  }, [ajaxUrl, csrfToken, loadStatus]);

  return (
    <AdminSection
      id="nc-admin-his-pack"
      title="Ghana background field pack"
      description="Tunes History & Lifestyle for West Africa OPD — hides US screening fields (exams grid, seatbelt use, hazardous activities) and adds a sickle-cell family field (M6-F28)."
      icon={<HeartPulse className="h-4 w-4" aria-hidden />}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {status?.applied ? (
            <Badge variant="success">Applied</Badge>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={applying || status === null}
              onClick={handleApply}
            >
              {applying ? 'Applying…' : 'Apply Ghana background pack'}
            </Button>
          )}
        </div>
      }
      variant="muted"
    >
      {error && <div className={deskCalloutClass('error', 'py-2 text-sm')}>{error}</div>}
      {resultNote && !error && (
        <div className={deskCalloutClass('success', 'py-2 text-sm')}>{resultNote}</div>
      )}
      {!error && !resultNote && (
        <p className="mb-0 text-sm text-[var(--oe-nc-text-muted)]">
          Idempotent — safe to re-run. Existing patient history data is never deleted.
        </p>
      )}
    </AdminSection>
  );
}
