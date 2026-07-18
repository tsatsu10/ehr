import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@components/ui/accordion';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import {
  CalendarClock,
  FlaskConical,
  Globe2,
  Landmark,
  Link2,
  LayoutGrid,
  MessageSquare,
  NotebookText,
  Pill,
  Receipt,
  Route,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  StickyNote,
  UserPlus,
  X,
} from 'lucide-react';
import { AdminConfigField } from '../AdminConfigField';
import { QUEUE_FIELD_SECTIONS } from '../adminFieldDefs';
import type { AdminFieldDef, AdminFieldSection } from '../adminFieldDefs';
import type { AncillaryLbfPackStatus, GhanaLbfPackStatus, ReferralHospitalLbfPackStatus } from '../adminTypes';
import { AdminEmptyState, AdminInsetPanel } from '../adminUi';
import { FlowBoardLaneMapPanel } from './FlowBoardLaneMapPanel';
import { ProviderColorsPanel } from './ProviderColorsPanel';

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

const SECTION_ICONS: Record<string, ReactNode> = {
  'Desks & queue basics': <LayoutGrid className="h-4 w-4" aria-hidden />,
  'Lab desk & Lab Operations (M12)': <FlaskConical className="h-4 w-4" aria-hidden />,
  'Pharmacy desk & Pharmacy Operations (M13)': <Pill className="h-4 w-4" aria-hidden />,
  'Cashier billing behavior (CBILL)': <Receipt className="h-4 w-4" aria-hidden />,
  'Multi-doctor & routing': <Route className="h-4 w-4" aria-hidden />,
  'Chart depth & clinical add-ons': <Stethoscope className="h-4 w-4" aria-hidden />,
  'Communications & registry': <MessageSquare className="h-4 w-4" aria-hidden />,
  'Registration & duplicate detection (M1)': <UserPlus className="h-4 w-4" aria-hidden />,
  'Safety & chart integration': <ShieldAlert className="h-4 w-4" aria-hidden />,
  'Ops polish (V1.1-OPS)': <Sparkles className="h-4 w-4" aria-hidden />,
  'Billing back office (M14)': <Landmark className="h-4 w-4" aria-hidden />,
  'Admin Hub (M15)': <Settings2 className="h-4 w-4" aria-hidden />,
  'Office Notes & Documents (GAP-A)': <StickyNote className="h-4 w-4" aria-hidden />,
  'Reporting Operations Hub (M16)': <CalendarClock className="h-4 w-4" aria-hidden />,
  'Scheduling & Flow (S1)': <CalendarClock className="h-4 w-4" aria-hidden />,
  'Queue Bridge Hub (M18)': <Link2 className="h-4 w-4" aria-hidden />,
  'Clinical Documentation Hub (M17)': <NotebookText className="h-4 w-4" aria-hidden />,
  'Regional, branding & advanced': <Globe2 className="h-4 w-4" aria-hidden />,
};

interface FieldBlock {
  root: AdminFieldDef;
  children: AdminFieldDef[];
}

/** Cluster a section's flat field list into root-toggle + its dependent sub-settings. */
function toBlocks(fields: AdminFieldDef[]): FieldBlock[] {
  const blocks: FieldBlock[] = [];
  for (const field of fields) {
    if (!field.indent) {
      blocks.push({ root: field, children: [] });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].children.push(field);
    } else {
      blocks.push({ root: field, children: [] });
    }
  }
  return blocks;
}

function isFieldOn(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function sectionKey(section: AdminFieldSection, idx: number): string {
  return section.title ?? `section-${idx}`;
}

function textMatches(haystack: string | undefined, query: string): boolean {
  return Boolean(haystack && haystack.toLowerCase().includes(query));
}

function fieldMatchesQuery(field: AdminFieldDef, query: string): boolean {
  return textMatches(field.label, query) || textMatches(field.hint, query) || textMatches(field.key, query);
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
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState<string[]>(() => [
    sectionKey(QUEUE_FIELD_SECTIONS[0], 0),
  ]);

  // The M17 hub is always on since 2026-07-18 (flag retired) — LBF pack panels always show.
  const hubEnabled = true;
  const referralHospitalBundle = settings.clinical_doc_bundle === 'referral_hospital_v1';
  const schedulingEnabled = settings.enable_scheduled_integration === true
    || settings.enable_scheduled_integration === '1'
    || settings.enable_scheduled_integration === 1;

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;

  const visibleSections = useMemo(() => QUEUE_FIELD_SECTIONS.map((section, idx) => {
    const key = sectionKey(section, idx);
    if (!searching) {
      return { key, section, fields: section.fields, onCount: section.fields.filter((f) => isFieldOn(settings[f.key])).length };
    }
    const titleMatches = textMatches(section.title, trimmedQuery) || textMatches(section.description, trimmedQuery);
    const fields = titleMatches ? section.fields : section.fields.filter((f) => fieldMatchesQuery(f, trimmedQuery));
    return { key, section, fields, onCount: section.fields.filter((f) => isFieldOn(settings[f.key])).length };
  }).filter((entry) => !searching || entry.fields.length > 0), [searching, trimmedQuery, settings]);

  const accordionValue = searching ? visibleSections.map((entry) => entry.key) : openSections;

  const jumpTo = (key: string) => {
    setOpenSections((prev) => (prev.includes(key) ? prev : [...prev, key]));
    requestAnimationFrame(() => {
      document.getElementById(`nc-admin-group-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="nc-admin-queue-tab">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="mb-0 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--oe-nc-text)]">
            Queue & roles
          </h2>
          <p className="mb-0 mt-1 text-sm text-[var(--oe-nc-text-muted)]">
            Turn on optional desks, hubs, and behavior for this clinic — grouped by area.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--oe-nc-text-muted)]"
            aria-hidden
          />
          <Input
            type="search"
            id="nc-admin-queue-search"
            placeholder="Search settings…"
            aria-label="Search settings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
            }}
            className="pl-9 pr-8"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[var(--oe-nc-text-muted)] hover:text-[var(--oe-nc-text)]"
              onClick={() => setQuery('')}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {!searching && (
        <div className="nc-admin-jumpchips mb-4 flex flex-wrap gap-1.5" role="navigation" aria-label="Jump to settings group">
          {QUEUE_FIELD_SECTIONS.map((section, idx) => {
            const key = sectionKey(section, idx);
            return (
              <button
                key={key}
                type="button"
                className="nc-admin-jumpchip"
                onClick={() => jumpTo(key)}
              >
                {section.title ?? 'Settings'}
              </button>
            );
          })}
        </div>
      )}

      {visibleSections.length === 0 ? (
        <AdminEmptyState
          title="No settings match your search"
          description="Try a different word, or clear the search to see every group."
        />
      ) : (
        <Accordion
          type="multiple"
          value={accordionValue}
          onValueChange={setOpenSections}
          className="nc-admin-settings-groups flex flex-col gap-3"
        >
          {visibleSections.map(({ key, section, fields, onCount }) => (
            <AccordionItem
              key={key}
              value={key}
              id={`nc-admin-group-${key}`}
              className="nc-admin-group-card mb-0 rounded-xl border-[var(--oe-nc-border)] shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))] transition-shadow duration-200 hover:shadow-[var(--oe-nc-shadow-md,0_4px_6px_rgba(0,0,0,0.08))]"
            >
              <AccordionTrigger className="bg-[var(--oe-nc-surface,#fff)] px-4 py-4 hover:bg-[var(--oe-nc-bg-tint,#f8fafc)]">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.5rem] bg-[color-mix(in_srgb,var(--oe-nc-primary)_10%,white)] text-[var(--oe-nc-primary)]">
                    {SECTION_ICONS[section.title ?? ''] ?? <Settings2 className="h-4 w-4" aria-hidden />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{section.title ?? 'Settings'}</span>
                    {section.description && (
                      <span className="mt-0.5 block truncate text-xs font-normal normal-case text-[var(--oe-nc-text-muted)]">
                        {section.description}
                      </span>
                    )}
                  </span>
                </span>
                {onCount > 0 && (
                  <Badge variant="neutral" className="ml-2 shrink-0">
                    {onCount} on
                  </Badge>
                )}
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 pt-1">
                <div className="nc-admin-settings-list divide-y divide-[var(--oe-nc-border)]/60">
                  {toBlocks(fields).map((block) => (
                    <div key={block.root.key} className="nc-admin-settings-block py-1 first:pt-0 last:pb-0">
                      <AdminConfigField
                        def={block.root}
                        value={settings[block.root.key]}
                        onChange={onFieldChange}
                      />
                      {block.children.length > 0 && (
                        <div className="nc-admin-subsection mb-2 mt-1 rounded-[0.5rem] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-3 py-1">
                          {block.children.map((child) => (
                            <AdminConfigField
                              key={child.key}
                              def={child}
                              value={settings[child.key]}
                              onChange={onFieldChange}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {section.title === 'Scheduling & Flow (S1)' && !schedulingEnabled && (
                  <p className="mb-0 py-1 text-sm text-[var(--oe-nc-text-muted)]">
                    Turn on “Link Front Desk to OpenEMR calendar” (Desks &amp; queue basics) to configure Flow Board lanes and provider colors.
                  </p>
                )}

                {section.title === 'Scheduling & Flow (S1)' && schedulingEnabled && (
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
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
