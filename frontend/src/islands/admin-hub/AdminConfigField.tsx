import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { cn } from '@/lib/utils';
import type { AdminFieldDef } from './adminFieldDefs';

interface AdminConfigFieldProps {
  def: AdminFieldDef;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

export function AdminConfigField({ def, value, onChange }: AdminConfigFieldProps) {
  const id = `cfg-${def.key}`;
  const indentClass = def.indent ? `ml-${def.indent * 3}` : '';
  const hint = def.hint ? (
    <p className="text-xs text-[var(--oe-nc-text-muted)] m-0">{def.hint}</p>
  ) : null;

  if (def.type === 'bool') {
    return (
      <div className={cn('flex items-start gap-2', def.indent ? 'mb-2' : 'mb-3', indentClass)}>
        <Checkbox
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(def.key, checked === true)}
        />
        <div className="space-y-1">
          <Label htmlFor={id} className="font-normal normal-case cursor-pointer">
            {def.label}
          </Label>
          {hint}
        </div>
      </div>
    );
  }

  if (def.type === 'int') {
    return (
      <div className={cn('space-y-1.5', indentClass, 'mb-3')}>
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
      <div className={cn('space-y-1.5', indentClass, 'mb-3')}>
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
    <div className={cn('space-y-1.5', indentClass, 'mb-3')}>
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
