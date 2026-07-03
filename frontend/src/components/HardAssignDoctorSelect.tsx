import type { AssignableDoctor } from '@core/types';

interface HardAssignDoctorSelectProps {
  id: string;
  doctors: AssignableDoctor[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function HardAssignDoctorSelect({
  id,
  doctors,
  value,
  onChange,
  disabled = false,
  className = 'form-control form-control-sm',
}: HardAssignDoctorSelectProps) {
  return (
    <select
      id={id}
      className={className}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Shared pool — no hard assignment</option>
      {doctors.map((doctor) => (
        <option key={doctor.user_id} value={String(doctor.user_id)}>
          {doctor.display_name}
          {!doctor.taking_patients ? ' (not taking patients)' : ''}
        </option>
      ))}
    </select>
  );
}
