import { t } from '@core/i18n';
import type { DoctorRosterRow } from './useDoctorRoster';

interface DoctorTeamRosterProps {
  doctors: DoctorRosterRow[];
  myUserId: number;
  loading: boolean;
}

/** Collapsible team view — advisory context only; personal toggle lives in the status bar. */
export function DoctorTeamRoster({ doctors, myUserId, loading }: DoctorTeamRosterProps) {
  if (loading && doctors.length === 0) {
    return null;
  }
  if (doctors.length === 0) {
    return null;
  }

  const takingCount = doctors.filter((row) => row.taking_patients).length;

  return (
    <details className="nc-doctor-team-roster">
      <summary className="nc-doctor-team-roster__summary">
        {t('{taking} of {total} taking patients', { taking: takingCount, total: doctors.length })}
      </summary>
      <ul className="nc-doctor-team-roster__list">
        {doctors.map((row) => {
          const isSelf = row.user_id === myUserId;
          return (
            <li key={row.user_id} className="nc-doctor-team-roster__row">
              <span className="nc-doctor-team-roster__name">
                {row.display_name}
                {isSelf && <span className="nc-doctor-team-roster__you"> {t('(you)')}</span>}
              </span>
              <span className="nc-doctor-team-roster__meta">
                {row.taking_patients ? (
                  <>
                    <span className="nc-doctor-team-roster__status nc-doctor-team-roster__status--on">{t('On')}</span>
                    {' · '}
                    {t('{count} in queue', { count: row.queue_load })}
                  </>
                ) : (
                  <span className="nc-doctor-team-roster__status">{t('Paused')}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
