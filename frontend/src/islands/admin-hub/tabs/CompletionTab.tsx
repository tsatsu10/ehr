import { COMPLETION_FIELDS } from '../adminFieldDefs';
import { AdminConfigField } from '../AdminConfigField';

interface CompletionTabProps {
  settings: Record<string, unknown>;
  onFieldChange: (key: string, value: unknown) => void;
}

export function CompletionTab({ settings, onFieldChange }: CompletionTabProps) {
  return (
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
  );
}
