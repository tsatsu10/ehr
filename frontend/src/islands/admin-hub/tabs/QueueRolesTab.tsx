import { QUEUE_FIELD_SECTIONS } from '../adminFieldDefs';
import { AdminConfigField } from '../AdminConfigField';

import type { GhanaLbfPackStatus } from '../adminTypes';

interface QueueRolesTabProps {
  settings: Record<string, unknown>;
  ghanaLbfPack: GhanaLbfPackStatus;
  ghanaLbfImporting: boolean;
  onFieldChange: (key: string, value: unknown) => void;
  onImportGhanaLbfPack: (setAsConsultNote: boolean) => void;
}

export function QueueRolesTab({
  settings,
  ghanaLbfPack,
  ghanaLbfImporting,
  onFieldChange,
  onImportGhanaLbfPack,
}: QueueRolesTabProps) {
  const hubEnabled = settings.enable_clinical_doc_hub === true
    || settings.enable_clinical_doc_hub === '1'
    || settings.enable_clinical_doc_hub === 1;

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
          </div>
        ))}
      </div>
    </div>
  );
}
