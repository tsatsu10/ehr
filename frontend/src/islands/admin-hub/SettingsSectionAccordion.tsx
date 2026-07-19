import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@components/ui/accordion';
import { Badge } from '@components/ui/badge';
import { Input } from '@components/ui/input';
import { Search, Settings2, X } from 'lucide-react';
import { AdminConfigField } from './AdminConfigField';
import type { AdminFieldDef, AdminFieldSection } from './adminFieldDefs';
import { AdminEmptyState } from './adminUi';
import { scrollToAndFlashField } from './scrollToField';

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

export interface SettingsSectionAccordionProps {
  heading: string;
  description: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  idPrefix: string;
  sections: AdminFieldSection[];
  sectionIcons: Record<string, ReactNode>;
  settings: Record<string, unknown>;
  onFieldChange: (key: string, value: unknown) => void;
  /** Slot for section-specific inline panels (e.g. LBF pack importers) rendered after the field list. */
  renderSectionExtra?: (sectionTitle: string | undefined) => ReactNode;
  /** ADM-1: a field key to open its section, scroll to, and flash — set by the global sidebar search. */
  highlightKey?: string | null;
  /** Called once the highlight has been applied (or found nothing), so the caller can clear its pending state. */
  onHighlightHandled?: () => void;
}

/**
 * Shared search + jump-chip + accordion rendering for a settings-field-section list.
 * Used by both Queue & desks and Features — same interaction model, different section sets
 * (ADM-3 split what was one "Queue & roles" mega-tab into two destinations).
 */
export function SettingsSectionAccordion({
  heading,
  description,
  searchPlaceholder,
  searchAriaLabel,
  idPrefix,
  sections,
  sectionIcons,
  settings,
  onFieldChange,
  renderSectionExtra,
  highlightKey,
  onHighlightHandled,
}: SettingsSectionAccordionProps) {
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState<string[]>(() =>
    sections.length > 0 ? [sectionKey(sections[0], 0)] : []
  );

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;

  useEffect(() => {
    if (!highlightKey) {
      return;
    }
    const idx = sections.findIndex((section) => section.fields.some((f) => f.key === highlightKey));
    if (idx === -1) {
      onHighlightHandled?.();
      return;
    }
    // A leftover local search query drives `accordionValue` instead of
    // `openSections` (see below), and can filter the target section out of
    // `visibleSections` entirely — either way the highlight would silently
    // fail to find its row. The global sidebar search jump always wins.
    setQuery('');
    const key = sectionKey(sections[idx], idx);
    setOpenSections((prev) => (prev.includes(key) ? prev : [...prev, key]));
    // Radix animates the section open — wait for it to mount before scrolling.
    const timer = window.setTimeout(() => {
      scrollToAndFlashField(highlightKey);
      onHighlightHandled?.();
    }, 120);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the target key itself changes
  }, [highlightKey]);

  const visibleSections = useMemo(() => sections.map((section, idx) => {
    const key = sectionKey(section, idx);
    if (!searching) {
      return { key, section, fields: section.fields, onCount: section.fields.filter((f) => isFieldOn(settings[f.key])).length };
    }
    const titleMatches = textMatches(section.title, trimmedQuery) || textMatches(section.description, trimmedQuery);
    const fields = titleMatches ? section.fields : section.fields.filter((f) => fieldMatchesQuery(f, trimmedQuery));
    return { key, section, fields, onCount: section.fields.filter((f) => isFieldOn(settings[f.key])).length };
  }).filter((entry) => !searching || entry.fields.length > 0), [searching, trimmedQuery, settings, sections]);

  const accordionValue = searching ? visibleSections.map((entry) => entry.key) : openSections;

  const jumpTo = (key: string) => {
    setOpenSections((prev) => (prev.includes(key) ? prev : [...prev, key]));
    requestAnimationFrame(() => {
      document.getElementById(`nc-admin-group-${idPrefix}-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="nc-admin-settings-accordion">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="mb-0 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--oe-nc-text)]">
            {heading}
          </h2>
          <p className="mb-0 mt-1 text-sm text-[var(--oe-nc-text-muted)]">{description}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--oe-nc-text-muted)]"
            aria-hidden
          />
          <Input
            type="search"
            id={`nc-admin-${idPrefix}-search`}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
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

      {!searching && sections.length > 1 && (
        <div className="nc-admin-jumpchips mb-4 flex flex-wrap gap-1.5" role="navigation" aria-label="Jump to settings group">
          {sections.map((section, idx) => {
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
              id={`nc-admin-group-${idPrefix}-${key}`}
              className="nc-admin-group-card mb-0 rounded-xl border-[var(--oe-nc-border)] shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))] transition-shadow duration-200 hover:shadow-[var(--oe-nc-shadow-md,0_4px_6px_rgba(0,0,0,0.08))]"
            >
              <AccordionTrigger className="bg-[var(--oe-nc-surface,#fff)] px-4 py-4 hover:bg-[var(--oe-nc-bg-tint,#f8fafc)]">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.5rem] bg-[color-mix(in_srgb,var(--oe-nc-primary)_10%,white)] text-[var(--oe-nc-primary)]">
                    {sectionIcons[section.title ?? ''] ?? <Settings2 className="h-4 w-4" aria-hidden />}
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
                {renderSectionExtra?.(section.title)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
