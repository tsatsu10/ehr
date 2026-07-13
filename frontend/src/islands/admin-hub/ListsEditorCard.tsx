import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
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
import { ListChecks } from 'lucide-react';
import { oeFetch } from '@core/oeFetch';
import { AdminSection } from './adminUi';

interface ListCatalogEntry {
  list_id: string;
  label: string;
  option_count: number;
  active_count: number;
}

interface ListOptionRow {
  option_id: string;
  title: string;
  seq: number;
  active: boolean;
}

interface ListsEditorCardProps {
  ajaxUrl: string;
  csrfToken: string;
}

export function ListsEditorCard({ ajaxUrl, csrfToken }: ListsEditorCardProps) {
  const [catalog, setCatalog] = useState<ListCatalogEntry[]>([]);
  const [listId, setListId] = useState('');
  const [options, setOptions] = useState<ListOptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // editId: null = form closed, '' = adding new, otherwise the option_id being edited.
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [seq, setSeq] = useState('0');

  const opts = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  // Guard against state updates after unmount (e.g. tabbing away mid-load).
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadOptions = async (id: string) => {
    setListId(id);
    setEditId(null);
    setError(null);
    setLoading(true);
    try {
      const data = await oeFetch<{ options?: ListOptionRow[] }>('admin.lists.options', {
        ...opts,
        params: { list_id: id },
      });
      if (!mountedRef.current) return;
      setOptions(data?.options ?? []);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load list.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await oeFetch<{ lists?: ListCatalogEntry[] }>('admin.lists.catalog', opts);
        if (cancelled) return;
        const lists = data?.lists ?? [];
        setCatalog(lists);
        const first = lists[0]?.list_id ?? '';
        if (first) {
          await loadOptions(first);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load editable lists.');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  const startAdd = () => { setEditId(''); setTitle(''); setSeq('0'); };
  const startEdit = (o: ListOptionRow) => { setEditId(o.option_id); setTitle(o.title); setSeq(String(o.seq)); };

  const save = async () => {
    if (title.trim() === '') { setError('A label is required.'); return; }
    setBusy(true);
    setError(null);
    try {
      const data = await oeFetch<{ options?: ListOptionRow[] }>('admin.lists.save', {
        ...opts,
        json: {
          list_id: listId,
          option: { option_id: editId ?? '', title: title.trim(), seq: Number.parseInt(seq, 10) || 0 },
        },
      });
      setOptions(data?.options ?? []);
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (o: ListOptionRow) => {
    setBusy(true);
    setError(null);
    try {
      const data = await oeFetch<{ options?: ListOptionRow[] }>('admin.lists.set_active', {
        ...opts,
        json: { list_id: listId, option_id: o.option_id, active: !o.active },
      });
      setOptions(data?.options ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminSection
      title="Clinic lists"
      description="Rename, reorder, add, or hide options in the lists this clinic curates."
      icon={<ListChecks className="h-4 w-4" aria-hidden />}
      action={
        <Button type="button" size="sm" id="nc-admin-list-add" disabled={!listId || loading} onClick={startAdd}>
          Add option
        </Button>
      }
    >
      <div className="mb-3 max-w-sm space-y-1.5">
        <Label htmlFor="nc-admin-list-picker">List</Label>
        <Select value={listId} onValueChange={(v) => { void loadOptions(v); }}>
          <SelectTrigger id="nc-admin-list-picker">
            <SelectValue placeholder="Choose a list" />
          </SelectTrigger>
          <SelectContent>
            {catalog.map((c) => (
              <SelectItem key={c.list_id} value={c.list_id}>
                {c.label} ({c.active_count}/{c.option_count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {editId !== null && (
        <div className="mb-3 rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint)] p-3" id="nc-admin-list-form">
          <p className="mb-2 text-sm font-semibold">{editId === '' ? 'Add option' : 'Edit option'}</p>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-7 space-y-1.5">
              <Label htmlFor="nc-admin-list-title">Label</Label>
              <Input
                id="nc-admin-list-title"
                maxLength={255}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="col-span-12 md:col-span-3 space-y-1.5">
              <Label htmlFor="nc-admin-list-seq">Order</Label>
              <Input
                id="nc-admin-list-seq"
                type="number"
                min={0}
                step={1}
                value={seq}
                onChange={(e) => setSeq(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" id="nc-admin-list-save" disabled={busy} onClick={() => { void save(); }}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} id="nc-admin-list-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading…</p>
      ) : !options.length ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">No options in this list yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map((o) => (
                <TableRow key={o.option_id} className={o.active ? '' : 'text-[var(--oe-nc-text-muted)]'}>
                  <TableCell>{o.title}</TableCell>
                  <TableCell>{o.seq}</TableCell>
                  <TableCell>{o.active ? 'Active' : 'Hidden'}</TableCell>
                  <TableCell className="text-nowrap">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mr-3"
                      disabled={busy}
                      onClick={() => startEdit(o)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      disabled={busy}
                      onClick={() => { void toggle(o); }}
                    >
                      {o.active ? 'Hide' : 'Show'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminSection>
  );
}
