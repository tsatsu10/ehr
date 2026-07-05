import { Card, CardContent } from '@components/ui/card';
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
      <Card>
        <CardContent>
          {COMPLETION_FIELDS.map((def) => (
            <AdminConfigField
              key={def.key}
              def={def}
              value={settings[def.key]}
              onChange={onFieldChange}
            />
          ))}
        </CardContent>
      </Card>

      <CompletionWeightsEditor
        payload={completionFieldWeights}
        saving={weightsSaving}
        error={weightsError}
        onSave={onSaveWeights}
      />
    </>
  );
}
