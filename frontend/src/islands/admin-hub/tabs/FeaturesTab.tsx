import type { ReactNode } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  CalendarClock,
  FlaskConical,
  Landmark,
  Link2,
  MessageSquare,
  NotebookText,
  Pill,
  Receipt,
  Settings2,
  Sparkles,
  Stethoscope,
  StickyNote,
} from 'lucide-react';
import { FEATURE_SECTIONS } from '../adminFieldDefs';
import type { AncillaryLbfPackStatus, GhanaLbfPackStatus, ReferralHospitalLbfPackStatus } from '../adminTypes';
import { AdminInsetPanel } from '../adminUi';
import { SettingsSectionAccordion } from '../SettingsSectionAccordion';
import { FlowBoardLaneMapPanel } from './FlowBoardLaneMapPanel';
import { ProviderColorsPanel } from './ProviderColorsPanel';

interface FeaturesTabProps {
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
  /** ADM-1: a field key to open its section, scroll to, and flash — set by the global sidebar search. */
  highlightKey?: string | null;
  onHighlightHandled?: () => void;
}

const SECTION_ICONS: Record<string, ReactNode> = {
  'Lab desk & Lab Operations (M12)': <FlaskConical className="h-4 w-4" aria-hidden />,
  'Pharmacy desk & Pharmacy Operations (M13)': <Pill className="h-4 w-4" aria-hidden />,
  'Cashier billing behavior (CBILL)': <Receipt className="h-4 w-4" aria-hidden />,
  'Chart depth & clinical add-ons': <Stethoscope className="h-4 w-4" aria-hidden />,
  'Communications & registry': <MessageSquare className="h-4 w-4" aria-hidden />,
  'Ops polish (V1.1-OPS)': <Sparkles className="h-4 w-4" aria-hidden />,
  'Billing back office (M14)': <Landmark className="h-4 w-4" aria-hidden />,
  'Admin Hub (M15)': <Settings2 className="h-4 w-4" aria-hidden />,
  'Documents & patient chat (GAP-A)': <StickyNote className="h-4 w-4" aria-hidden />,
  'Reporting Operations Hub (M16)': <CalendarClock className="h-4 w-4" aria-hidden />,
  'Scheduling & Flow (S1)': <CalendarClock className="h-4 w-4" aria-hidden />,
  'Queue Bridge Hub (M18)': <Link2 className="h-4 w-4" aria-hidden />,
  'Clinical Documentation Hub (M17)': <NotebookText className="h-4 w-4" aria-hidden />,
};

export function FeaturesTab({
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
  highlightKey,
  onHighlightHandled,
}: FeaturesTabProps) {
  const referralHospitalBundle = settings.clinical_doc_bundle === 'referral_hospital_v1';
  const schedulingEnabled = settings.enable_scheduled_integration === true
    || settings.enable_scheduled_integration === '1'
    || settings.enable_scheduled_integration === 1;

  return (
    <SettingsSectionAccordion
      heading="Features"
      description="Optional modules, desks, and hubs — turn on what this clinic uses."
      searchPlaceholder="Search features…"
      searchAriaLabel="Search features"
      idPrefix="features"
      sections={FEATURE_SECTIONS}
      sectionIcons={SECTION_ICONS}
      settings={settings}
      onFieldChange={onFieldChange}
      highlightKey={highlightKey}
      onHighlightHandled={onHighlightHandled}
      renderSectionExtra={(title) => (
        <>
          {title === 'Scheduling & Flow (S1)' && !schedulingEnabled && (
            <p className="mb-0 py-1 text-sm text-[var(--oe-nc-text-muted)]">
              Turn on “Link Front Desk to OpenEMR calendar” (Queue &amp; desks → Desks &amp; queue basics) to configure Flow Board lanes and provider colors.
            </p>
          )}

          {title === 'Scheduling & Flow (S1)' && schedulingEnabled && (
            <>
              <FlowBoardLaneMapPanel
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                facilityId={facilityId}
                schedulingEnabled={schedulingEnabled}
              />
              <ProviderColorsPanel
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                facilityId={facilityId}
                schedulingEnabled={schedulingEnabled}
              />
            </>
          )}

          {title === 'Clinical Documentation Hub (M17)' && (
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
          {title === 'Clinical Documentation Hub (M17)' && referralHospitalBundle && (
            <AdminInsetPanel className="mt-2">
              <h6 className="mb-1">Referral hospital consult template (LBF)</h6>
              <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
                Extended structured consult for multi-specialty and referral centers. Imports layout
                <code className="mx-1">{referralHospitalLbfPack.form_id ?? 'LBFreferral_opd_consult'}</code>
                into OpenEMR Layout-Based Forms. Opens through the form bridge alongside
                the native React consult form.
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
          {title === 'Clinical Documentation Hub (M17)' && ancillaryLbfPacks.length > 0 && (
            <AdminInsetPanel className="mt-2">
              <h6 className="mb-1">Ancillary attestation forms (LBF)</h6>
              <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
                Lab-direct and pharmacy walk-in service profiles require these layout-based forms (PRD §17.3 step 8).
              </p>
              <ul className="list-none m-0 p-0 mb-0">
                {ancillaryLbfPacks.map((pack) => (
                  <li key={pack.pack_key} className="flex flex-wrap items-center justify-between mb-2 border-b border-[var(--oe-nc-border)]/60 pb-2">
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
        </>
      )}
    />
  );
}
