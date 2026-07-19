import type { ReactNode } from 'react';
import { LayoutGrid, Route, ShieldAlert, UserPlus } from 'lucide-react';
import { QUEUE_DESK_SECTIONS } from '../adminFieldDefs';
import { SettingsSectionAccordion } from '../SettingsSectionAccordion';
import type { SettingOverrideInfo } from '../adminTypes';

interface QueueDesksTabProps {
  settings: Record<string, unknown>;
  onFieldChange: (key: string, value: unknown) => void;
  /** ADM-5: facility-scope override transparency — undefined under global scope. */
  settingsOverrides?: Record<string, SettingOverrideInfo>;
  resettingOverrideKey?: string | null;
  onResetOverride?: (key: string, label: string) => void;
  /** ADM-1: a field key to open its section, scroll to, and flash — set by the global sidebar search. */
  highlightKey?: string | null;
  onHighlightHandled?: () => void;
}

const SECTION_ICONS: Record<string, ReactNode> = {
  'Desks & queue basics': <LayoutGrid className="h-4 w-4" aria-hidden />,
  'Multi-doctor & routing': <Route className="h-4 w-4" aria-hidden />,
  'Registration & duplicate detection (M1)': <UserPlus className="h-4 w-4" aria-hidden />,
  'Safety & chart integration': <ShieldAlert className="h-4 w-4" aria-hidden />,
};

export function QueueDesksTab({
  settings,
  onFieldChange,
  settingsOverrides,
  resettingOverrideKey,
  onResetOverride,
  highlightKey,
  onHighlightHandled,
}: QueueDesksTabProps) {
  return (
    <SettingsSectionAccordion
      heading="Queue & desks"
      description="Which desks are on, and how patients move through the queue."
      searchPlaceholder="Search queue & desk settings…"
      searchAriaLabel="Search queue and desk settings"
      idPrefix="queue-desks"
      sections={QUEUE_DESK_SECTIONS}
      sectionIcons={SECTION_ICONS}
      settings={settings}
      onFieldChange={onFieldChange}
      settingsOverrides={settingsOverrides}
      resettingOverrideKey={resettingOverrideKey}
      onResetOverride={onResetOverride}
      highlightKey={highlightKey}
      onHighlightHandled={onHighlightHandled}
    />
  );
}
