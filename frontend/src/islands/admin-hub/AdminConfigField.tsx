import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { Switch } from '@components/ui/switch';
import type { AdminFieldDef } from './adminFieldDefs';

interface AdminConfigFieldProps {
  def: AdminFieldDef;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

export function AdminConfigField({ def, value, onChange }: AdminConfigFieldProps) {
  const id = `cfg-${def.key}`;
  const indentStyle = def.indent
    ? {
        marginLeft: `${def.indent * 1.25}rem`,
        paddingLeft: '0.75rem',
        borderLeft: '2px solid var(--oe-nc-border)',
      }
    : undefined;
  const hint = def.hint ? (
    <p className="text-xs text-[var(--oe-nc-text-muted)] m-0">{def.hint}</p>
  ) : null;

  if (def.type === 'bool') {
    return (
      <div className="nc-admin-setting-row flex items-start justify-between gap-4 py-2" style={indentStyle}>
        <div className="min-w-0 flex-1 space-y-0.5">
          <Label htmlFor={id} className="font-normal normal-case cursor-pointer">
            {def.label}
          </Label>
          {hint}
        </div>
        <Switch
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(def.key, checked)}
          className="mt-0.5 shrink-0"
        />
      </div>
    );
  }

  if (def.type === 'int') {
    return (
      <div className="space-y-1.5 mb-3" style={indentStyle}>
        <Label htmlFor={id}>{def.label}</Label>
        <Input
          type="number"
          className="w-auto"
          id={id}
          min={def.min}
          max={def.max}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(def.key, Number.parseInt(e.target.value, 10) || 0)}
        />
        {hint}
      </div>
    );
  }

  if (def.type === 'select' && def.choices) {
    const strValue = value === undefined || value === null ? '' : String(value);

    return (
      <div className="space-y-1.5 mb-3" style={indentStyle}>
        <Label htmlFor={id}>{def.label}</Label>
        <Select value={strValue} onValueChange={(next) => onChange(def.key, next)}>
          <SelectTrigger id={id} className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {def.choices.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hint}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 mb-3" style={indentStyle}>
      <Label htmlFor={id}>{def.label}</Label>
      <Input
        type="text"
        id={id}
        maxLength={def.maxLength}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(def.key, e.target.value)}
      />
      {hint}
    </div>
  );
}
