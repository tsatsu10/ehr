import { COMPLETION_FIELDS } from '../adminFieldDefs';
import { AdminConfigField } from '../AdminConfigField';
import { CompletionWeightsEditor } from '../CompletionWeightsEditor';
import type { CompletionFieldWeightPayload, CompletionFieldWeightRow } from '../adminTypes';

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
    <>
      <div className="card">
        <div className="card-body">
          {COMPLETION_FIELDS.map((def) => (
            <AdminConfigField
              key={def.key}
              def={def}
              value={settings[def.key]}
              onChange={onFieldChange}
            />
          ))}
        </div>
      </div>

      <CompletionWeightsEditor
        payload={completionFieldWeights}
        saving={weightsSaving}
        error={weightsError}
        onSave={onSaveWeights}
      />
    </>
  );
}
