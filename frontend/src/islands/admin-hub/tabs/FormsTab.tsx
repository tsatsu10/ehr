import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import type {
  AncillaryLbfPackStatus,
  FormBundleBoardPayload,
  FormsCatalogItem,
  FormsCatalogPayload,
} from '../adminTypes';
import { FormBundleBoard } from '../FormBundleBoard';
import { FormsCatalog } from '../FormsCatalog';

interface FormsTabProps {
  board: FormBundleBoardPayload;
  catalog: FormsCatalogPayload;
  ancillaryLbfPacks: AncillaryLbfPackStatus[];
  importingPackKey: string | null;
  installingAll: boolean;
  catalogTogglingId: number | null;
  onImportPack: (packKey: string) => void;
  onInstallAllMissing: () => void;
  onToggleCatalogForm: (item: FormsCatalogItem, enabled: boolean) => void;
}

export function FormsTab({
  board,
  catalog,
  catalogTogglingId,
  onToggleCatalogForm,
  ...bundleProps
}: FormsTabProps) {
  return (
    <div>
      <FormBundleBoard board={board} {...bundleProps} />
      <FormsCatalog
        catalog={catalog}
        togglingId={catalogTogglingId}
        onToggle={onToggleCatalogForm}
      />
      <Card>
        <CardContent>
          <h6 className="text-[var(--oe-nc-text-muted)] uppercase text-sm">Advanced</h6>
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">
            Full OpenEMR layout and list editors. Changes here can affect M1a search and M3–M9 gates.
          </p>
          <Button variant="warning" size="sm" className="mr-2 mb-1" asChild>
            <a href={catalog.forms_admin_url} target="_top">
              Registered forms (stock)
            </a>
          </Button>
          <Button variant="warning" size="sm" className="mr-2 mb-1" asChild>
            <a href={catalog.layout_editor_url} target="_top">
              Layout-Based Forms editor
            </a>
          </Button>
          <Button variant="warning" size="sm" className="mb-1" asChild>
            <a href={catalog.list_editor_url} target="_top">
              List options editor
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
