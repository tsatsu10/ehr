import { useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Card, CardContent } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import type { FormsCatalogItem, FormsCatalogPayload } from './adminTypes';

interface FormsCatalogProps {
  catalog: FormsCatalogPayload;
  togglingId: number | null;
  onToggle: (item: FormsCatalogItem, enabled: boolean) => void;
}

export function FormsCatalog({ catalog, togglingId, onToggle }: FormsCatalogProps) {
  const [query, setQuery] = useState('');
  const [bundleOnly, setBundleOnly] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.items.filter((item) => {
      if (bundleOnly && !item.bundle_required) {
        return false;
      }
      if (needle === '') {
        return true;
      }
      return item.name.toLowerCase().includes(needle)
        || item.directory.toLowerCase().includes(needle)
        || item.category.toLowerCase().includes(needle);
    });
  }, [bundleOnly, catalog.items, query]);

  return (
    <Card className="mb-3" id="nc-admin-forms-catalog">
      <CardContent>
        <div className="flex flex-wrap items-start justify-between mb-2">
          <div>
            <h5 className="text-base font-semibold mb-1">Registered forms</h5>
            <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">
              Enable or disable encounter forms. Bundle-required forms are listed first (M15-F07).
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={catalog.forms_admin_url} target="_top">
              Full Forms Administration
            </a>
          </Button>
        </div>

        {!catalog.can_edit && (
          <div className={deskCalloutClass('info', 'py-2 text-sm mb-3')}>
            Read-only — enabling or disabling forms requires core <code>admin/forms</code> ACL.
          </div>
        )}

        <div className="flex flex-wrap items-center mb-3">
          <Input
            type="search"
            className="h-8 mr-2 mb-2"
            style={{ maxWidth: '16rem' }}
            placeholder="Search forms…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search registered forms"
          />
          <div className="flex items-center gap-2 mb-2">
            <Checkbox
              id="nc-admin-forms-bundle-only"
              checked={bundleOnly}
              onCheckedChange={(checked) => setBundleOnly(checked === true)}
            />
            <Label htmlFor="nc-admin-forms-bundle-only" className="font-normal normal-case cursor-pointer mb-0">
              Bundle forms only
            </Label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
            <TableHeader className="bg-[var(--oe-nc-bg-tint)]">
              <TableRow>
                <TableHead scope="col">Form</TableHead>
                <TableHead scope="col">Directory</TableHead>
                <TableHead scope="col">Category</TableHead>
                <TableHead scope="col" className="text-center">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const blockedOff = item.enabled && item.disable_blocked;
                const canToggle = catalog.can_edit && !blockedOff;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>{item.name}</div>
                      {item.bundle_required && (
                        <Badge className="mr-1">Bundle</Badge>
                      )}
                      {item.enable_warning && item.enabled && (
                        <div className="text-sm text-[var(--color-oe-warning,#ea580c)] mt-1">{item.enable_warning}</div>
                      )}
                      {!item.enabled && item.disable_block_reason && (
                        <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">{item.disable_block_reason}</div>
                      )}
                    </TableCell>
                    <TableCell><code className="text-sm">{item.directory}</code></TableCell>
                    <TableCell className="text-sm text-[var(--oe-nc-text-muted)]">{item.category || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        size="sm"
                        variant={item.enabled ? 'default' : 'outline'}
                        className={item.enabled ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : undefined}
                        disabled={!canToggle || togglingId === item.id}
                        title={
                          blockedOff
                            ? item.disable_block_reason ?? 'Cannot disable'
                            : item.enabled
                              ? 'Disable form'
                              : 'Enable form'
                        }
                        onClick={() => onToggle(item, !item.enabled)}
                      >
                        {togglingId === item.id ? '…' : item.enabled ? 'On' : 'Off'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-[var(--oe-nc-text-muted)] text-sm">No forms match your filter.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
