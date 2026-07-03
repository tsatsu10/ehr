import { QUEUE_FIELD_SECTIONS } from '../adminFieldDefs';
import { AdminConfigField } from '../AdminConfigField';

import type { AncillaryLbfPackStatus, GhanaLbfPackStatus } from '../adminTypes';

import { FlowBoardLaneMapPanel } from './FlowBoardLaneMapPanel';

interface QueueRolesTabProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  settings: Record<string, unknown>;
  ghanaLbfPack: GhanaLbfPackStatus;
  ghanaLbfImporting: boolean;
  ancillaryLbfPacks: AncillaryLbfPackStatus[];
  ancillaryLbfImporting: string | null;
  onFieldChange: (key: string, value: unknown) => void;
  onImportGhanaLbfPack: (setAsConsultNote: boolean) => void;
  onImportAncillaryLbfPack: (packKey: string) => void;
}

export function QueueRolesTab({
  ajaxUrl,
  csrfToken,
  facilityId,
  settings,
  ghanaLbfPack,
  ghanaLbfImporting,
  ancillaryLbfPacks,
  ancillaryLbfImporting,
  onFieldChange,
  onImportGhanaLbfPack,
  onImportAncillaryLbfPack,
}: QueueRolesTabProps) {
  const hubEnabled = settings.enable_clinical_doc_hub === true
    || settings.enable_clinical_doc_hub === '1'
    || settings.enable_clinical_doc_hub === 1;
  const schedulingEnabled = settings.enable_scheduling_redesign === true
    || settings.enable_scheduling_redesign === '1'
    || settings.enable_scheduling_redesign === 1;

  return (
    <div className="card">
      <div className="card-body">
        <p className="text-muted">Enable optional desks and queue behavior.</p>
        {QUEUE_FIELD_SECTIONS.map((section, idx) => (
          <div key={section.title ?? `section-${idx}`}>
            {section.title && (
              <>
                {idx > 0 && <hr className="my-3" />}
                <h6 className="text-muted text-uppercase small">{section.title}</h6>
              </>
            )}
            {section.fields.map((def) => (
              <AdminConfigField
                key={def.key}
                def={def}
                value={settings[def.key]}
                onChange={onFieldChange}
              />
            ))}
            {section.title === 'Scheduling & Flow (S1)' && schedulingEnabled && (
              <FlowBoardLaneMapPanel
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                facilityId={facilityId}
                schedulingEnabled={schedulingEnabled}
              />
            )}
            {section.title === 'Clinical Documentation Hub (M17)' && hubEnabled && (
              <div className="border rounded p-3 mt-2 bg-light">
                <h6 className="mb-1">Ghana OPD consult template (LBF)</h6>
                <p className="text-muted small mb-2">
                  Optional structured consult form for West Africa OPD. Imports layout
                  <code className="mx-1">{ghanaLbfPack.form_id ?? 'LBFghana_opd_consult'}</code>
                  into OpenEMR Layout-Based Forms.
                </p>
                <p className="small mb-2" id="nc-admin-ghana-lbf-status">
                  <span className={`badge badge-${ghanaLbfPack.installed ? 'success' : 'secondary'} mr-2`}>
                    {ghanaLbfPack.installed ? 'Installed' : 'Not installed'}
                  </span>
                  {ghanaLbfPack.is_primary_consult_note
                    ? 'Set as primary consult note.'
                    : 'Stock SOAP remains primary unless you import with that option.'}
                </p>
                <div className="d-flex flex-wrap">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm mr-2 mb-2"
                    id="nc-admin-import-ghana-lbf"
                    disabled={ghanaLbfImporting || ghanaLbfPack.installed}
                    onClick={() => onImportGhanaLbfPack(false)}
                  >
                    {ghanaLbfImporting ? 'Importing…' : 'Import template'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mb-2"
                    id="nc-admin-import-ghana-lbf-primary"
                    disabled={ghanaLbfImporting || (ghanaLbfPack.installed && ghanaLbfPack.is_primary_consult_note)}
                    onClick={() => onImportGhanaLbfPack(true)}
                  >
                    {ghanaLbfImporting ? 'Importing…' : 'Import & set as consult note'}
                  </button>
                </div>
              </div>
            )}
            {section.title === 'Clinical Documentation Hub (M17)' && hubEnabled && ancillaryLbfPacks.length > 0 && (
              <div className="border rounded p-3 mt-2 bg-light">
                <h6 className="mb-1">Ancillary attestation forms (LBF)</h6>
                <p className="text-muted small mb-2">
                  Lab-direct and pharmacy walk-in service profiles require these layout-based forms (PRD §17.3 step 8).
                </p>
                <ul className="list-unstyled mb-0">
                  {ancillaryLbfPacks.map((pack) => (
                    <li key={pack.pack_key} className="d-flex flex-wrap align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <div>
                        <strong>{pack.title}</strong>
                        <code className="mx-1 small">{pack.form_id}</code>
                        <span className={`badge badge-${pack.installed ? 'success' : 'secondary'}`}>
                          {pack.installed ? 'Installed' : 'Not installed'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        disabled={pack.installed || ancillaryLbfImporting === pack.pack_key}
                        onClick={() => onImportAncillaryLbfPack(pack.pack_key)}
                      >
                        {ancillaryLbfImporting === pack.pack_key ? 'Importing…' : 'Import'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
