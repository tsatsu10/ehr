import { CalendarDays, ExternalLink } from 'lucide-react';
import type { FrontDeskDeskStats } from '@core/types';
import { Button } from '@components/ui/button';
import { DeskQueueStatusBar } from '@components/DeskQueueStatusBar';

interface DeskStatusBarProps {
  stats: FrontDeskDeskStats | null;
  loading: boolean;
  onRefresh: () => void;
  visitBoardUrl?: string;
  schedulingEnabled?: boolean;
  appointmentsTodayCount?: number;
  calendarUrl?: string;
}

export function DeskStatusBar({
  stats,
  loading,
  onRefresh,
  visitBoardUrl,
  schedulingEnabled = false,
  appointmentsTodayCount = 0,
  calendarUrl,
}: DeskStatusBarProps) {
  const waiting = stats?.waiting_count ?? 0;
  const started = stats?.visits_started_today ?? 0;

  const items = [
    {
      label: 'Waiting now',
      value: waiting,
      href: waiting > 0 ? visitBoardUrl : undefined,
    },
    {
      label: 'Visits started today',
      value: started,
    },
    ...(schedulingEnabled
      ? [{
          label: 'Scheduled today',
          value: appointmentsTodayCount,
          icon: <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />,
        }]
      : []),
  ];

  return (
    <DeskQueueStatusBar
      id="nc-desk-status-bar"
      ariaLabel="Front desk status"
      items={items}
      loading={loading}
      onRefresh={onRefresh}
      trailing={
        schedulingEnabled && calendarUrl ? (
          <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
            <a href={calendarUrl} target="_top">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Calendar</span>
            </a>
          </Button>
        ) : undefined
      }
    />
  );
}
