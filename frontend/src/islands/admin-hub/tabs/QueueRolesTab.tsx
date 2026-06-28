import { QUEUE_FIELD_SECTIONS } from '../adminFieldDefs';
import { AdminConfigField } from '../AdminConfigField';

interface QueueRolesTabProps {
  settings: Record<string, unknown>;
  onFieldChange: (key: string, value: unknown) => void;
}

export function QueueRolesTab({ settings, onFieldChange }: QueueRolesTabProps) {
  return (
    <div className="card">
      <div className="card-body">
        <p className="text-muted">Enable optional desks and queue behavior.</p>
        {QUEUE_FIELD_SECTIONS.map((section, idx) => (
          <div key={section.title ?? `section-${idx}`}>
            {section.title && (
              <>
                {idx > 0 && <hr className="my-3" />}
                <h6 className="text-muted text-uppercase small">{section.title}</h6>
              </>
            )}
            {section.fields.map((def) => (
              <AdminConfigField
                key={def.key}
                def={def}
                value={settings[def.key]}
                onChange={onFieldChange}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
