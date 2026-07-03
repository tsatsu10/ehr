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
      <div className="card">
        <div className="card-body">
          <h6 className="text-muted text-uppercase small">Advanced</h6>
          <p className="small text-muted mb-2">
            Full OpenEMR layout and list editors. Changes here can affect M1a search and M3–M9 gates.
          </p>
          <a className="btn btn-outline-warning btn-sm mr-2 mb-1" href={catalog.forms_admin_url} target="_top">
            Registered forms (stock)
          </a>
          <a className="btn btn-outline-warning btn-sm mr-2 mb-1" href={catalog.layout_editor_url} target="_top">
            Layout-Based Forms editor
          </a>
          <a className="btn btn-outline-warning btn-sm mb-1" href={catalog.list_editor_url} target="_top">
            List options editor
          </a>
        </div>
      </div>
    </div>
  );
}
