import { useCallback, useEffect, useMemo, useState } from 'react';
import { useModalDismiss } from '@components/useModalDismiss';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Checkbox } from '@components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';
import { oeFetch } from '@core/oeFetch';

interface CatalogOption {
  value: string;
  label: string;
}

interface CatalogDrug {
  drug_id: number;
  name: string;
  form: string;
  form_label: string;
  size: string;
  unit: string;
  unit_label: string;
  route: string;
  route_label: string;
  reorder_point: number;
  ndc_number: string;
  active: boolean;
  dispensable: boolean;
}

interface CatalogPayload {
  drugs?: CatalogDrug[];
  form_options?: CatalogOption[];
  route_options?: CatalogOption[];
  unit_options?: CatalogOption[];
}

interface PharmOpsCatalogPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  enabled: boolean;
}

const NONE = '_none';

export function PharmOpsCatalogPanel({ ajaxUrl, csrfToken, enabled }: PharmOpsCatalogPanelProps) {
  const [drugs, setDrugs] = useState<CatalogDrug[]>([]);
  const [formOptions, setFormOptions] = useState<CatalogOption[]>([]);
  const [routeOptions, setRouteOptions] = useState<CatalogOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Drawer form fields.
  const [fName, setFName] = useState('');
  const [fForm, setFForm] = useState('');
  const [fSize, setFSize] = useState('');
  const [fUnit, setFUnit] = useState('');
  const [fRoute, setFRoute] = useState('');
  const [fReorder, setFReorder] = useState('0');
  const [fNdc, setFNdc] = useState('');
  const [fActive, setFActive] = useState(true);

  const opts = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const applyPayload = useCallback((data: CatalogPayload | null) => {
    setDrugs(data?.drugs ?? []);
    if (data?.form_options) setFormOptions(data.form_options);
    if (data?.route_options) setRouteOptions(data.route_options);
    if (data?.unit_options) setUnitOptions(data.unit_options);
  }, []);

  const load = useCallback(async (q: string) => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await oeFetch<CatalogPayload>('pharm_ops.catalog_list', { ...opts, params: { q } });
      applyPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the drug catalog.');
    } finally {
      setLoading(false);
    }
  }, [enabled, opts, applyPayload]);

  useEffect(() => { void load(''); }, [load]);

  const openEdit = (drug: CatalogDrug | null) => {
    setEditId(drug?.drug_id ?? 0);
    setFName(drug?.name ?? '');
    setFForm(drug?.form ?? '');
    setFSize(drug?.size ?? '');
    setFUnit(drug?.unit ?? '');
    setFRoute(drug?.route ?? '');
    setFReorder(String(drug?.reorder_point ?? 0));
    setFNdc(drug?.ndc_number ?? '');
    setFActive(drug ? drug.active : true);
    setSaveError(null);
    setEditOpen(true);
  };

  useModalDismiss(editOpen, () => setEditOpen(false));

  const save = async () => {
    if (fName.trim() === '') { setSaveError('Drug name is required.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const data = await oeFetch<CatalogPayload>('pharm_ops.catalog_save', {
        ...opts,
        json: {
          drug: {
            drug_id: editId,
            name: fName.trim(),
            form: fForm,
            size: fSize.trim(),
            unit: fUnit,
            route: fRoute,
            ndc_number: fNdc.trim(),
            reorder_point: Number.parseFloat(fReorder) || 0,
            active: fActive,
          },
        },
      });
      setEditOpen(false);
      // Keep the table consistent with the active search box rather than the
      // unfiltered list the save returns.
      const term = search.trim();
      if (term !== '') {
        await load(term);
      } else {
        applyPayload(data);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className="mt-3 border-top pt-3" id="nc-pharmops-catalog">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold mb-0">Drug catalog (formulary)</h3>
        <Button type="button" size="sm" id="nc-pharmops-catalog-add" onClick={() => openEdit(null)}>
          Add drug
        </Button>
      </div>
      <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">
        Add or edit individual products, reorder points, and units. Bulk changes still use the CSV
        import above; stock drug inventory remains available for advanced fields.
      </p>

      <form
        className="mb-2 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); void load(search.trim()); }}
      >
        <Input
          type="search"
          className="h-8 max-w-xs"
          id="nc-pharmops-catalog-search"
          placeholder="Search name or NDC…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline" size="sm" disabled={loading}>Search</Button>
      </form>

      {error && <div className={deskCalloutClass('warn', 'py-2 mb-2')} role="alert">{error}</div>}

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">Loading catalog…</p>
      ) : drugs.length === 0 ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">No drugs match. Add one or import the starter formulary.</p>
      ) : (
        <div className="overflow-x-auto mb-2" style={{ maxHeight: '18rem', overflowY: 'auto' }}>
          <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Drug</TableHead>
                <TableHead scope="col">Form</TableHead>
                <TableHead scope="col">Strength</TableHead>
                <TableHead scope="col">Reorder</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drugs.map((drug) => (
                <TableRow key={drug.drug_id} className={drug.active ? '' : 'text-[var(--oe-nc-text-muted)]'}>
                  <TableCell>{drug.name}</TableCell>
                  <TableCell>{drug.form_label || '—'}</TableCell>
                  <TableCell>{[drug.size, drug.unit_label].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell>{drug.reorder_point}</TableCell>
                  <TableCell>{drug.active ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell className="text-nowrap">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 nc-pharmops-catalog-edit"
                      onClick={() => openEdit(drug)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editOpen && (
        <Dialog open={editOpen} onOpenChange={(next) => { if (!next) setEditOpen(false); }}>
          <DialogContent id="nc-pharmops-catalog-modal" className={dialogContentSizeClass.lg} aria-labelledby="nc-pharmops-catalog-title">
            <DialogHeader>
              <DialogTitle id="nc-pharmops-catalog-title">{editId > 0 ? 'Edit drug' : 'Add drug'}</DialogTitle>
              <DialogClose aria-label="Close"><span aria-hidden="true">&times;</span></DialogClose>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-8 space-y-1.5">
                  <Label htmlFor="nc-pharmops-drug-name">Name</Label>
                  <Input id="nc-pharmops-drug-name" maxLength={255} value={fName} onChange={(e) => setFName(e.target.value)} />
                </div>
                <div className="col-span-12 md:col-span-4 space-y-1.5">
                  <Label htmlFor="nc-pharmops-drug-form">Form</Label>
                  <Select value={fForm || NONE} onValueChange={(v) => setFForm(v === NONE ? '' : v)}>
                    <SelectTrigger id="nc-pharmops-drug-form"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {formOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-12 md:col-span-4 space-y-1.5">
                  <Label htmlFor="nc-pharmops-drug-size">Strength / size</Label>
                  <Input id="nc-pharmops-drug-size" maxLength={25} value={fSize} onChange={(e) => setFSize(e.target.value)} />
                </div>
                <div className="col-span-12 md:col-span-4 space-y-1.5">
                  <Label htmlFor="nc-pharmops-drug-unit">Unit</Label>
                  <Select value={fUnit || NONE} onValueChange={(v) => setFUnit(v === NONE ? '' : v)}>
                    <SelectTrigger id="nc-pharmops-drug-unit"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {unitOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-12 md:col-span-4 space-y-1.5">
                  <Label htmlFor="nc-pharmops-drug-route">Route</Label>
                  <Select value={fRoute || NONE} onValueChange={(v) => setFRoute(v === NONE ? '' : v)}>
                    <SelectTrigger id="nc-pharmops-drug-route"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {routeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-12 md:col-span-4 space-y-1.5">
                  <Label htmlFor="nc-pharmops-drug-reorder">Reorder point</Label>
                  <Input id="nc-pharmops-drug-reorder" type="number" min={0} step={1} value={fReorder} onChange={(e) => setFReorder(e.target.value)} />
                </div>
                <div className="col-span-12 md:col-span-8 space-y-1.5">
                  <Label htmlFor="nc-pharmops-drug-ndc">NDC / barcode (optional)</Label>
                  <Input id="nc-pharmops-drug-ndc" maxLength={20} value={fNdc} onChange={(e) => setFNdc(e.target.value)} />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm" htmlFor="nc-pharmops-drug-active">
                <Checkbox id="nc-pharmops-drug-active" checked={fActive} onCheckedChange={(c) => setFActive(c === true)} />
                Active in the catalog
              </label>
              {saveError && (
                <div className={deskCalloutClass('error', 'mt-2 text-sm')} role="alert">{saveError}</div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="button" id="nc-pharmops-catalog-save" disabled={saving} onClick={() => { void save(); }}>
                {saving ? 'Saving…' : 'Save drug'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
