import { Button } from '@components/ui/button';
import { cn } from '@/lib/utils';

interface DoctorDutyToggleProps {
  taking: boolean;
  saving: boolean;
  onToggle: (next: boolean) => void;
}

/** Personal on-duty toggle — belongs in the desk status bar, not the queue column. */
export function DoctorDutyToggle({ taking, saving, onToggle }: DoctorDutyToggleProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        'nc-doctor-duty-toggle h-7 gap-1.5 px-2.5 text-xs font-medium',
        taking && 'nc-doctor-duty-toggle--on',
      )}
      disabled={saving}
      aria-pressed={taking}
      onClick={() => onToggle(!taking)}
      title={taking ? 'You are taking patients — click to pause' : 'You are paused — click to take patients'}
    >
      <span
        className={cn(
          'nc-doctor-duty-toggle__dot',
          taking ? 'nc-doctor-duty-toggle__dot--on' : 'nc-doctor-duty-toggle__dot--off',
        )}
        aria-hidden="true"
      />
      {taking ? 'Taking patients' : 'Paused'}
    </Button>
  );
}
