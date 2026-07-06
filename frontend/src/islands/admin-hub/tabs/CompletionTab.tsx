import { ClipboardCheck } from 'lucide-react';
import { COMPLETION_FIELDS } from '../adminFieldDefs';
import { AdminConfigField } from '../AdminConfigField';
import { CompletionWeightsEditor } from '../CompletionWeightsEditor';
import type { CompletionFieldWeightPayload, CompletionFieldWeightRow } from '../adminTypes';
import { AdminSection, AdminStack } from '../adminUi';

interface CompletionTabProps {
  settings: Record<string, unknown>;
  completionFieldWeights: CompletionFieldWeightPayload | null;
  weightsSaving: boolean;
  weightsError: string | null;
  onFieldChange: (key: string, value: unknown) => void;
  onSaveWeights: (items: CompletionFieldWeightRow[]) => void;
}

export function CompletionTab({
  settings,
  completionFieldWeights,
  weightsSaving,
  weightsError,
  onFieldChange,
  onSaveWeights,
}: CompletionTabProps) {
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
