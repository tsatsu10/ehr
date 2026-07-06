import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { LayoutGrid } from 'lucide-react';
import { AdminConfigField } from '../AdminConfigField';
import { QUEUE_FIELD_SECTIONS } from '../adminFieldDefs';
import type { AncillaryLbfPackStatus, GhanaLbfPackStatus, ReferralHospitalLbfPackStatus } from '../adminTypes';
import { AdminInsetPanel, AdminSection } from '../adminUi';
import { FlowBoardLaneMapPanel } from './FlowBoardLaneMapPanel';

interface QueueRolesTabProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  settings: Record<string, unknown>;
  ghanaLbfPack: GhanaLbfPackStatus;
  ghanaLbfImporting: boolean;
  referralHospitalLbfPack: ReferralHospitalLbfPackStatus;
  referralHospitalLbfImporting: boolean;
  ancillaryLbfPacks: AncillaryLbfPackStatus[];
  ancillaryLbfImporting: string | null;
  onFieldChange: (key: string, value: unknown) => void;
  onImportGhanaLbfPack: (setAsConsultNote: boolean) => void;
  onImportReferralHospitalLbfPack: (setAsConsultNote: boolean) => void;
  onImportAncillaryLbfPack: (packKey: string) => void;
}

export function QueueRolesTab({
  ajaxUrl,
  csrfToken,
  facilityId,
  settings,
  ghanaLbfPack,
  ghanaLbfImporting,
  referralHospitalLbfPack,
  referralHospitalLbfImporting,
  ancillaryLbfPacks,
  ancillaryLbfImporting,
  onFieldChange,
  onImportGhanaLbfPack,
  onImportReferralHospitalLbfPack,
  onImportAncillaryLbfPack,
}: QueueRolesTabProps) {
  const hubEnabled = settings.enable_clinical_doc_hub === true
    || settings.enable_clinical_doc_hub === '1'
    || settings.enable_clinical_doc_hub === 1;
  const referralHospitalBundle = settings.clinical_doc_bundle === 'referral_hospital_v1';
  const schedulingEnabled = settings.enable_scheduling_redesign === true
    || settings.enable_scheduling_redesign === '1'
    || settings.enable_scheduling_redesign === 1;

  return (
    <AdminSection
      title="Queue & roles"
      description="Enable optional desks and queue behavior for this clinic."
      icon={<LayoutGrid className="h-4 w-4" aria-hidden />}
    >
      {QUEUE_FIELD_SECTIONS.map((section, idx) => (
          <div key={section.title ?? `section-${idx}`}>
            {section.title && (
              <>
                {idx > 0 && <hr className="my-3" />}
                <h6 className="text-[var(--oe-nc-text-muted)] uppercase text-sm">{section.title}</h6>
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
              <AdminInsetPanel className="mt-2">
                <h6 className="mb-1">Ghana OPD consult template (LBF)</h6>
                <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
                  Optional structured consult form for West Africa OPD. Imports layout
                  <code className="mx-1">{ghanaLbfPack.form_id ?? 'LBFghana_opd_consult'}</code>
                  into OpenEMR Layout-Based Forms.
                </p>
                <p className="text-sm mb-2" id="nc-admin-ghana-lbf-status">
                  <Badge variant={ghanaLbfPack.installed ? 'success' : 'neutral'} className="mr-2">
                    {ghanaLbfPack.installed ? 'Installed' : 'Not installed'}
                  </Badge>
                  {ghanaLbfPack.is_primary_consult_note
                    ? 'Set as primary consult note.'
                    : 'Stock SOAP remains primary unless you import with that option.'}
                </p>
                <div className="flex flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mr-2 mb-2"
                    id="nc-admin-import-ghana-lbf"
                    disabled={ghanaLbfImporting || ghanaLbfPack.installed}
                    onClick={() => onImportGhanaLbfPack(false)}
                  >
                    {ghanaLbfImporting ? 'Importing…' : 'Import template'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="mb-2"
                    id="nc-admin-import-ghana-lbf-primary"
                    disabled={ghanaLbfImporting || (ghanaLbfPack.installed && ghanaLbfPack.is_primary_consult_note)}
                    onClick={() => onImportGhanaLbfPack(true)}
                  >
                    {ghanaLbfImporting ? 'Importing…' : 'Import & set as consult note'}
                  </Button>
                </div>
              </AdminInsetPanel>
            )}
            {section.title === 'Clinical Documentation Hub (M17)' && hubEnabled && referralHospitalBundle && (
              <AdminInsetPanel className="mt-2">
                <h6 className="mb-1">Referral hospital consult template (LBF)</h6>
                <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
                  Extended structured consult for multi-specialty and referral centers. Imports layout
                  <code className="mx-1">{referralHospitalLbfPack.form_id ?? 'LBFreferral_opd_consult'}</code>
                  into OpenEMR Layout-Based Forms. Use with
                  <code className="mx-1">encounter_note_engine=legacy</code>
                  {' '}or as a bridge until the native React form is enabled.
                </p>
                <p className="text-sm mb-2" id="nc-admin-referral-hospital-lbf-status">
                  <Badge variant={referralHospitalLbfPack.installed ? 'success' : 'neutral'} className="mr-2">
                    {referralHospitalLbfPack.installed ? 'Installed' : 'Not installed'}
                  </Badge>
                  {referralHospitalLbfPack.is_primary_consult_note
                    ? 'Set as primary consult note.'
                    : 'Stock SOAP remains primary unless you import with that option.'}
                </p>
                <div className="flex flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mr-2 mb-2"
                    id="nc-admin-import-referral-hospital-lbf"
                    disabled={referralHospitalLbfImporting || referralHospitalLbfPack.installed}
                    onClick={() => onImportReferralHospitalLbfPack(false)}
                  >
                    {referralHospitalLbfImporting ? 'Importing…' : 'Import template'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="mb-2"
                    id="nc-admin-import-referral-hospital-lbf-primary"
                    disabled={referralHospitalLbfImporting || (referralHospitalLbfPack.installed && referralHospitalLbfPack.is_primary_consult_note)}
                    onClick={() => onImportReferralHospitalLbfPack(true)}
                  >
                    {referralHospitalLbfImporting ? 'Importing…' : 'Import & set as consult note'}
                  </Button>
                </div>
              </AdminInsetPanel>
            )}
            {section.title === 'Clinical Documentation Hub (M17)' && hubEnabled && ancillaryLbfPacks.length > 0 && (
              <AdminInsetPanel className="mt-2">
                <h6 className="mb-1">Ancillary attestation forms (LBF)</h6>
                <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
                  Lab-direct and pharmacy walk-in service profiles require these layout-based forms (PRD §17.3 step 8).
                </p>
                <ul className="list-none m-0 p-0 mb-0">
                  {ancillaryLbfPacks.map((pack) => (
                    <li key={pack.pack_key} className="flex flex-wrap items-center justify-between mb-2 pb-2 border-bottom">
                      <div>
                        <strong>{pack.title}</strong>
                        <code className="mx-1 text-sm">{pack.form_id}</code>
                        <Badge variant={pack.installed ? 'success' : 'neutral'}>
                          {pack.installed ? 'Installed' : 'Not installed'}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pack.installed || ancillaryLbfImporting === pack.pack_key}
                        onClick={() => onImportAncillaryLbfPack(pack.pack_key)}
                      >
                        {ancillaryLbfImporting === pack.pack_key ? 'Importing…' : 'Import'}
                      </Button>
                    </li>
                  ))}
                </ul>
              </AdminInsetPanel>
            )}
          </div>
        ))}
    </AdminSection>
  );
}
