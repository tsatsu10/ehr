import type { AdminFieldDef } from './adminFieldDefs';

interface AdminConfigFieldProps {
  def: AdminFieldDef;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

export function AdminConfigField({ def, value, onChange }: AdminConfigFieldProps) {
  const id = `cfg-${def.key}`;
  const indentClass = def.indent ? `ml-${def.indent * 3}` : '';

  if (def.type === 'bool') {
    return (
      <div className={`form-group form-check${def.indent ? ' mb-2' : ''} ${indentClass}`}>
        <input
          type="checkbox"
          className="form-check-input"
          id={id}
          checked={Boolean(value)}
          onChange={(e) => onChange(def.key, e.target.checked)}
        />
        <label className="form-check-label" htmlFor={id}>{def.label}</label>
        {def.hint && <small className="form-text text-muted">{def.hint}</small>}
      </div>
    );
  }

  if (def.type === 'int') {
    return (
      <div className={`form-group${indentClass}`}>
        <label htmlFor={id}>{def.label}</label>
        <input
          type="number"
          className="form-control w-auto"
          id={id}
          min={def.min}
          max={def.max}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(def.key, Number.parseInt(e.target.value, 10) || 0)}
        />
        {def.hint && <small className="form-text text-muted">{def.hint}</small>}
      </div>
    );
  }

  if (def.type === 'select' && def.choices) {
    return (
      <div className={`form-group${indentClass}`}>
        <label htmlFor={id}>{def.label}</label>
        <select
          className="form-control w-auto"
          id={id}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(def.key, e.target.value)}
        >
          {def.choices.map((choice) => (
            <option key={choice.value} value={choice.value}>{choice.label}</option>
          ))}
        </select>
        {def.hint && <small className="form-text text-muted">{def.hint}</small>}
      </div>
    );
  }

  return (
    <div className={`form-group${indentClass}`}>
      <label htmlFor={id}>{def.label}</label>
      <input
        type="text"
        className="form-control"
        id={id}
        maxLength={def.maxLength}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(def.key, e.target.value)}
      />
      {def.hint && <small className="form-text text-muted">{def.hint}</small>}
    </div>
  );
}
