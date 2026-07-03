export interface ChipItem {
  label: string;
  variant: 'severe' | 'warn';
  href?: string;
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
          chip.href ? (
            <a
              key={chip.label}
              href={chip.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`oe-nc-chip oe-nc-chip--${chip.variant}`}
            >
              {chip.label}
            </a>
          ) : (
          <span
            key={chip.label}
            className={`oe-nc-chip oe-nc-chip--${chip.variant}`}
          >
            {chip.label}
          </span>
          )
        ))}
      </div>
    </div>
  );
}
