import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { FileStack } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import type { AncillaryLbfPackStatus, FormBundleBoardPayload } from './adminTypes';
import { AdminInsetPanel, AdminSection } from './adminUi';

interface FormBundleBoardProps {
  board: FormBundleBoardPayload;
  ancillaryLbfPacks: AncillaryLbfPackStatus[];
  importingPackKey: string | null;
  installingAll: boolean;
  onImportPack: (packKey: string) => void;
  onInstallAllMissing: () => void;
}

function statusBadgeVariant(row: FormBundleBoardPayload['rows'][number]): 'neutral' | 'warning' | 'success' {
  if (!row.installed) {
    return 'neutral';
  }
  if (!row.esign_ok) {
    return 'warning';
  }
  return 'success';
}

export function FormBundleBoard({
  board,
  ancillaryLbfPacks,
  importingPackKey,
  installingAll,
  onImportPack,
  onInstallAllMissing,
}: FormBundleBoardProps) {
  const missingImportable = board.rows.filter((row) => row.can_import && row.pack_key);
  const showInstallAll = missingImportable.length > 1;

  return (
    <AdminSection
      id="nc-admin-form-bundle-board"
      title="Clinic form bundle"
      description="Required New Clinic forms — install and E-Sign readiness (M15-F06)."
      icon={<FileStack className="h-4 w-4" aria-hidden />}
      action={
        <div className="flex flex-wrap gap-2">
          {showInstallAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={installingAll || importingPackKey !== null}
              onClick={onInstallAllMissing}
            >
              {installingAll ? 'Installing…' : 'Install missing ancillary forms'}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={board.forms_admin_url} target="_top">
              Forms Administration
            </a>
          </Button>
        </div>
      }
    >
        {!board.esign_globally_enabled && (
          <div className={deskCalloutClass('warn', 'py-2 text-sm mb-3')}>
            E-Sign globals are off. Enable <code>esign_individual</code> (Cash clinic profile applies this) before go-live.
          </div>
        )}

        <div className="overflow-x-auto">
          <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-3' })}>
            <TableHeader className="bg-[var(--oe-nc-bg-tint)]">
              <TableRow>
                <TableHead scope="col">Form</TableHead>
                <TableHead scope="col">formdir</TableHead>
                <TableHead scope="col">Required for</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {board.rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.title}</TableCell>
                  <TableCell><code className="text-sm">{row.formdir}</code></TableCell>
                  <TableCell className="text-sm text-[var(--oe-nc-text-muted)]">{row.required_for}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(row)}>
                      {row.status_label}
                    </Badge>
                    {row.esign_detail && !row.esign_ok && (
                      <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">{row.esign_detail}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.can_import && row.pack_key ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={importingPackKey === row.pack_key || installingAll}
                        onClick={() => onImportPack(row.pack_key!)}
                      >
                        {importingPackKey === row.pack_key ? 'Importing…' : 'Import LBF'}
                      </Button>
                    ) : (
                      <span className="text-sm text-[var(--oe-nc-text-muted)]">{row.import_hint ?? '—'}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <AdminInsetPanel className="text-sm">
          <strong>Test E-Sign on a staging encounter</strong>
          <p className="mb-2 mt-1 text-[var(--oe-nc-text-muted)]">{board.test_esign_help}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={board.doctor_desk_url} target="_top">
                Open Doctor Desk
              </a>
            </Button>
            {board.clinical_doc_hub_enabled && (
              <Button variant="outline" size="sm" asChild>
                <a href={board.clinical_doc_hub_url} target="_top">
                  Clinical Documentation Hub
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={board.layout_editor_url} target="_top">
                Layout editor (Advanced)
              </a>
            </Button>
          </div>
        </AdminInsetPanel>

        {ancillaryLbfPacks.length > 0 && (
          <p className="mb-0 mt-2 text-sm text-[var(--oe-nc-text-muted)]">
            Ancillary packs:
            {' '}
            {ancillaryLbfPacks.map((pack) => `${pack.title} (${pack.installed ? 'installed' : 'pending'})`).join(' · ')}
          </p>
        )}
    </AdminSection>
  );
}
