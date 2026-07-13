import { Button } from '@components/ui/button';
import { Settings2 } from 'lucide-react';
import type {
  AncillaryLbfPackStatus,
  FormBundleBoardPayload,
  FormsCatalogItem,
  FormsCatalogPayload,
} from '../adminTypes';
import { FormBundleBoard } from '../FormBundleBoard';
import { FormsCatalog } from '../FormsCatalog';
import { HisPackCard } from '../HisPackCard';
import { ListsEditorCard } from '../ListsEditorCard';
import { AdminSection, AdminStack } from '../adminUi';

interface FormsTabProps {
  board: FormBundleBoardPayload;
  catalog: FormsCatalogPayload;
  ancillaryLbfPacks: AncillaryLbfPackStatus[];
  importingPackKey: string | null;
  installingAll: boolean;
  catalogTogglingId: number | null;
  ajaxUrl: string;
  csrfToken: string;
  onImportPack: (packKey: string) => void;
  onInstallAllMissing: () => void;
  onToggleCatalogForm: (item: FormsCatalogItem, enabled: boolean) => void;
}

export function FormsTab({
  board,
  catalog,
  catalogTogglingId,
  ajaxUrl,
  csrfToken,
  onToggleCatalogForm,
  ...bundleProps
}: FormsTabProps) {
  return (
    <AdminStack>
      <FormBundleBoard board={board} {...bundleProps} />
      <HisPackCard ajaxUrl={ajaxUrl} csrfToken={csrfToken} />
      <ListsEditorCard ajaxUrl={ajaxUrl} csrfToken={csrfToken} />
      <FormsCatalog
        catalog={catalog}
        togglingId={catalogTogglingId}
        onToggle={onToggleCatalogForm}
      />
      <AdminSection
        title="Advanced form editors"
        description="Full OpenEMR layout and list editors. Changes here can affect M1a search and M3–M9 gates."
        icon={<Settings2 className="h-4 w-4" aria-hidden />}
        variant="muted"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={catalog.forms_admin_url} target="_top">
              Registered forms (stock)
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={catalog.layout_editor_url} target="_top">
              Layout-Based Forms editor
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={catalog.list_editor_url} target="_top">
              List options editor
            </a>
          </Button>
        </div>
      </AdminSection>
    </AdminStack>
  );
}
