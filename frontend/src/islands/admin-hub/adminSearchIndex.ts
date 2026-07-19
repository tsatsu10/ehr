import type { AdminFieldDef, AdminFieldSection } from './adminFieldDefs';
import {
  CLINIC_CURRENCY_FIELDS,
  CLINIC_PRINT_FIELDS,
  CLINIC_RECONCILIATION_FIELDS,
  CLINIC_REGIONAL_SECTION,
  COMPLETION_FIELDS,
  FEATURE_SECTIONS,
  QUEUE_DESK_SECTIONS,
} from './adminFieldDefs';
import type { AdminTabId } from './adminTypes';

/** ADM-1: one settings field, findable from the global sidebar search. */
export interface AdminFieldSearchEntry {
  fieldKey: string;
  label: string;
  hint?: string;
  tab: AdminTabId;
  tabLabel: string;
  groupTitle?: string;
}

/**
 * ADM-1: a whole destination — for tabs that aren't field-def driven (Fees,
 * Visit types, Address Book, People & access, Forms, System, Import, Setup).
 * Their content is a data table or a sub-routed panel, not a static field
 * list, so there's nothing to index per-row before the page has loaded it —
 * this just makes the destination itself reachable by search.
 */
export interface AdminDestinationSearchEntry {
  tab: AdminTabId;
  tabLabel: string;
  description: string;
  keywords: string[];
}

function fromSections(sections: AdminFieldSection[], tab: AdminTabId, tabLabel: string): AdminFieldSearchEntry[] {
  return sections.flatMap((section) =>
    section.fields.map((field) => ({
      fieldKey: field.key,
      label: field.label,
      hint: field.hint,
      tab,
      tabLabel,
      groupTitle: section.title,
    }))
  );
}

function fromFields(
  fields: AdminFieldDef[],
  tab: AdminTabId,
  tabLabel: string,
  groupTitle: string
): AdminFieldSearchEntry[] {
  return fields.map((field) => ({
    fieldKey: field.key,
    label: field.label,
    hint: field.hint,
    tab,
    tabLabel,
    groupTitle,
  }));
}

export const ADMIN_FIELD_SEARCH_INDEX: AdminFieldSearchEntry[] = [
  ...fromSections(QUEUE_DESK_SECTIONS, 'queue-desks', 'Queue & desks'),
  ...fromSections(FEATURE_SECTIONS, 'features', 'Features'),
  ...fromFields(
    CLINIC_REGIONAL_SECTION.fields,
    'clinic',
    'Clinic',
    CLINIC_REGIONAL_SECTION.title ?? 'Regional, branding & advanced'
  ),
  ...fromFields(CLINIC_CURRENCY_FIELDS, 'clinic', 'Clinic', 'Clinic currency'),
  ...fromFields(CLINIC_PRINT_FIELDS, 'clinic', 'Clinic', 'Queue slip & receipt print'),
  ...fromFields(CLINIC_RECONCILIATION_FIELDS, 'clinic', 'Clinic', 'Cashier reconciliation'),
  ...fromFields(COMPLETION_FIELDS, 'completion', 'Completion', 'Completion gates'),
];

export const ADMIN_DESTINATION_SEARCH_INDEX: AdminDestinationSearchEntry[] = [
  { tab: 'setup', tabLabel: 'Setup', description: 'First-run checklist', keywords: ['checklist', 'onboarding', 'go-live'] },
  { tab: 'people', tabLabel: 'People & access', description: 'Staff accounts and permissions', keywords: ['staff', 'users', 'roles', 'permissions', 'acl'] },
  { tab: 'types', tabLabel: 'Visit types', description: 'What patients can be booked as', keywords: ['visit type', 'service profile'] },
  { tab: 'fees', tabLabel: 'Fees', description: 'Cash fee schedule', keywords: ['price', 'fee schedule', 'billing code'] },
  { tab: 'directory', tabLabel: 'Address Book', description: 'External referral contacts', keywords: ['contact', 'referral', 'specialist'] },
  { tab: 'import', tabLabel: 'Import patients', description: 'Bulk patient CSV import', keywords: ['csv', 'migration', 'bulk'] },
  { tab: 'forms', tabLabel: 'Forms', description: 'Encounter form registry', keywords: ['form bundle', 'lbf', 'registry'] },
  { tab: 'system', tabLabel: 'System', description: 'Health, backup, runbooks, audit log', keywords: ['backup', 'health', 'runbook', 'audit log', 'reconcile', 'duplicates', 'export', 'import config'] },
];

function textMatches(haystack: string | undefined, needle: string): boolean {
  return Boolean(haystack && haystack.toLowerCase().includes(needle));
}

const MAX_RESULTS = 20;

export function searchAdminFields(query: string): AdminFieldSearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [];
  }
  return ADMIN_FIELD_SEARCH_INDEX
    .filter((entry) => textMatches(entry.label, needle) || textMatches(entry.hint, needle) || textMatches(entry.fieldKey, needle))
    .slice(0, MAX_RESULTS);
}

export function searchAdminDestinations(query: string): AdminDestinationSearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [];
  }
  return ADMIN_DESTINATION_SEARCH_INDEX.filter((entry) =>
    textMatches(entry.tabLabel, needle)
    || textMatches(entry.description, needle)
    || entry.keywords.some((k) => k.includes(needle))
  );
}
