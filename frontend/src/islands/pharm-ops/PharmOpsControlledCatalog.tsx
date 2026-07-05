import { useCallback, useEffect, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { oeFetch } from '@core/oeFetch';
import type { PharmControlledCatalogData, PharmControlledCatalogDrug } from './pharmOpsTypes';

interface PharmOpsControlledCatalogProps {
  ajaxUrl: string;
  csrfToken: string;
  enabled: boolean;
}

export function PharmOpsControlledCatalog({
  ajaxUrl,
  csrfToken,
  enabled,
}: PharmOpsControlledCatalogProps) {
  const [drugs, setDrugs] = useState<PharmControlledCatalogDrug[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const loadCatalog = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await oeFetch<PharmControlledCatalogData>('pharm_ops.controlled_catalog', fetchOptions);
      setDrugs(data.drugs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load controlled drug flags');
      setDrugs([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchOptions]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const updateDrug = useCallback((drugId: number, patch: Partial<PharmControlledCatalogDrug>) => {
    setDrugs((current) => current.map((drug) => (
      drug.drug_id === drugId ? { ...drug, ...patch } : drug
    )));
  }, []);

  const saveFlags = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await oeFetch<PharmControlledCatalogData & { saved?: number }>(
        'pharm_ops.controlled_catalog_save',
        {
          ...fetchOptions,
          method: 'POST',
          json: {
            drugs: drugs.map((drug) => ({
              drug_id: drug.drug_id,
              is_controlled: drug.is_controlled,
              controlled_schedule_code: drug.controlled_schedule_code ?? '',
            })),
          },
        },
      );
      setDrugs(data.drugs ?? drugs);
      setSuccess('Controlled substance flags saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save controlled drug flags');
    } finally {
      setSaving(false);
    }
  }, [drugs, fetchOptions]);

  if (!enabled) return null;

  const controlledCount = drugs.filter((drug) => drug.is_controlled).length;

  return (
    <div className="mt-3 border-top pt-3" id="nc-pharmops-controlled-catalog">
      <h3 className="text-sm font-semibold mb-1">Controlled substances (O-PHARM-5)</h3>
      <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">
        Flag products that belong on the controlled register. Schedule codes are clinic-defined placeholders
        until national alignment is configured. View the register under Reports → Controlled substances register.
      </p>

      {error ? (
        <div className={deskCalloutClass('warn', 'py-2 mb-2')} role="alert">{error}</div>
      ) : null}
      {success ? (
        <div className={deskCalloutClass('success', 'py-2 mb-2')} role="status">{success}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">Loading catalog…</p>
      ) : drugs.length === 0 ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">Import the starter formulary to mark controlled products.</p>
      ) : (
        <>
          <p className="text-sm mb-2">
            {controlledCount}
            {' '}
            of
            {' '}
            {drugs.length}
            {' '}
            active product(s) flagged.
          </p>
          <div className="overflow-x-auto mb-2" style={{ maxHeight: '14rem', overflowY: 'auto' }}>
            <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Drug</TableHead>
                  <TableHead scope="col" className="text-center">Controlled</TableHead>
                  <TableHead scope="col">Schedule code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drugs.map((drug) => (
                  <TableRow key={drug.drug_id}>
                    <TableCell>{drug.drug_name}</TableCell>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        aria-label={`Mark ${drug.drug_name} as controlled`}
                        checked={drug.is_controlled}
                        onChange={(event) => {
                          updateDrug(drug.drug_id, { is_controlled: event.target.checked });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        className="h-8"
                        maxLength={32}
                        placeholder="e.g. B"
                        disabled={!drug.is_controlled}
                        value={drug.controlled_schedule_code ?? ''}
                        onChange={(event) => {
                          updateDrug(drug.drug_id, {
                            controlled_schedule_code: event.target.value,
                          });
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            id="nc-pharmops-controlled-save"
            disabled={saving}
            onClick={() => { void saveFlags(); }}
          >
            {saving ? 'Saving…' : 'Save controlled flags'}
          </Button>
        </>
      )}
    </div>
  );
}
