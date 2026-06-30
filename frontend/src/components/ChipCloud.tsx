export interface ChipItem {
  label: string;
  variant: 'severe' | 'warn';
}

interface ChipCloudProps {
  chips: ChipItem[];
  className?: string;
}

export function ChipCloud({ chips, className }: ChipCloudProps) {
  if (!chips.length) return null;

  return (
    <div className={className ?? 'oe-nc-patient-banner__section'}>
      <div className="oe-nc-chip-cloud">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className={`oe-nc-chip oe-nc-chip--${chip.variant}`}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}
