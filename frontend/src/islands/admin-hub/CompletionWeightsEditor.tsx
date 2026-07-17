import { useCallback, useEffect, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { SlidersHorizontal } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import type { CompletionFieldWeightPayload, CompletionFieldWeightRow } from './adminTypes';
import { AdminSection } from './adminUi';

interface CompletionWeightsEditorProps {
  payload: CompletionFieldWeightPayload | null;
  saving: boolean;
  error: string | null;
  onSave: (items: CompletionFieldWeightRow[]) => void;
}

export function CompletionWeightsEditor({
  payload,
  saving,
  error,
  onSave,
}: CompletionWeightsEditorProps) {
  const [items, setItems] = useState<CompletionFieldWeightRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setItems(payload?.items ?? []);
    setDirty(false);
  }, [payload]);

  const activeTotal = useMemo(
    () => items.reduce((sum, row) => sum + (row.is_active ? row.weight : 0), 0),
    [items]
  );

  const targetTotal = payload?.target_total ?? 100;
  const totalValid = activeTotal === targetTotal;

  const updateRow = useCallback((fieldKey: string, patch: Partial<CompletionFieldWeightRow>) => {
    setItems((prev) =>
      prev.map((row) => (row.field_key === fieldKey ? { ...row, ...patch } : row))
    );
    setDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave(items);
  }, [items, onSave]);

  if (!payload || items.length === 0) {
    return <p className="text-[var(--oe-nc-text-muted)] mb-0">Completion weights are not available.</p>;
  }

  return (
    <AdminSection
      title="Field weights"
      description={`Active weights must total ${targetTotal}. Disable optional fields instead of setting weight to 0 when you do not want them in the score.`}
      icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
    >
      <div className="overflow-x-auto">
        <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-3' })}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Level</TableHead>
                <TableHead scope="col">Field</TableHead>
                <TableHead scope="col" className="text-right">Weight</TableHead>
                <TableHead scope="col" className="text-center">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.field_key}>
                  <TableCell>
                    <span className="block text-sm text-[var(--oe-nc-text-muted)]">{row.level_label}</span>
                    <span className="sr-only">Level {row.level}</span>
                  </TableCell>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right" style={{ width: 110 }}>
                    <Input
                      type="number"
                      className="h-8 text-right"
                      min={0}
                      max={100}
                      value={row.weight}
                      disabled={!row.is_active}
                      onChange={(event) => {
                        updateRow(row.field_key, { weight: Number(event.target.value) || 0 });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center" style={{ width: 72 }}>
                    <Checkbox
                      checked={row.is_active}
                      aria-label={`Include ${row.label} in completion score`}
                      onCheckedChange={(checked) => {
                        updateRow(row.field_key, { is_active: checked === true });
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`mb-0 font-bold ${totalValid ? 'text-[var(--color-oe-cta,#2bb350)]' : 'text-[var(--oe-nc-danger,#dc2626)]'}`}>
            Active total: {activeTotal} / {targetTotal}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={!dirty || !totalValid || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save weights'}
          </Button>
        </div>

        {error && <div className={deskCalloutClass('error', 'mt-3 mb-0 py-2')}>{error}</div>}
    </AdminSection>
  );
}
