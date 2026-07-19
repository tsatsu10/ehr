import { useEffect } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { COMPLETION_FIELDS } from '../adminFieldDefs';
import { AdminConfigField } from '../AdminConfigField';
import { CompletionWeightsEditor } from '../CompletionWeightsEditor';
import type { CompletionFieldWeightPayload, CompletionFieldWeightRow, SettingOverrideInfo } from '../adminTypes';
import { AdminSection, AdminStack } from '../adminUi';
import { scrollToAndFlashField } from '../scrollToField';

interface CompletionTabProps {
  settings: Record<string, unknown>;
  /** ADM-5: facility-scope override transparency — undefined under global scope. */
  settingsOverrides?: Record<string, SettingOverrideInfo>;
  resettingOverrideKey?: string | null;
  onResetOverride?: (key: string, label: string) => void;
  completionFieldWeights: CompletionFieldWeightPayload | null;
  weightsSaving: boolean;
  weightsError: string | null;
  onFieldChange: (key: string, value: unknown) => void;
  onSaveWeights: (items: CompletionFieldWeightRow[]) => void;
  /** ADM-1: a field key to scroll to and flash — set by the global sidebar search. */
  highlightKey?: string | null;
  onHighlightHandled?: () => void;
}

export function CompletionTab({
  settings,
  settingsOverrides,
  resettingOverrideKey,
  onResetOverride,
  completionFieldWeights,
  weightsSaving,
  weightsError,
  onFieldChange,
  onSaveWeights,
  highlightKey,
  onHighlightHandled,
}: CompletionTabProps) {
  useEffect(() => {
    if (!highlightKey) {
      return;
    }
    scrollToAndFlashField(highlightKey);
    onHighlightHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the target key itself changes
  }, [highlightKey]);

  return (
    <AdminStack>
      <AdminSection
        title="Completion gates"
        description="Registration completeness thresholds and billing enforcement"
        icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
      >
        {COMPLETION_FIELDS.map((def) => (
          <AdminConfigField
            key={def.key}
            def={def}
            value={settings[def.key]}
            onChange={onFieldChange}
            overrideInfo={settingsOverrides?.[def.key]}
            onResetOverride={onResetOverride}
            resettingOverride={resettingOverrideKey === def.key}
          />
        ))}
      </AdminSection>

      <CompletionWeightsEditor
        payload={completionFieldWeights}
        saving={weightsSaving}
        error={weightsError}
        onSave={onSaveWeights}
      />
    </AdminStack>
  );
}
