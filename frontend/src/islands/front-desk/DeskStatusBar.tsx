import { CalendarDays, BellRing, ExternalLink, Undo2, Redo2 } from 'lucide-react';
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
  recallsUrl?: string;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function DeskStatusBar({
  stats,
  loading,
  onRefresh,
  visitBoardUrl,
  schedulingEnabled = false,
  appointmentsTodayCount = 0,
  calendarUrl,
  recallsUrl,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
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
        <div className="flex items-center gap-1">
          {/* Undo/Redo controls */}
          {(canUndo || canRedo) && (
            <div className="flex items-center gap-0.5 mr-2" role="navigation" aria-label="Patient history">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 px-0"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="Undo - Go back to previous patient (Ctrl+Z)"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 px-0"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label="Redo - Go forward to next patient (Ctrl+Shift+Z)"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          )}
          
          {/* Calendar/Recalls controls */}
          {schedulingEnabled && (calendarUrl || recallsUrl) && (
            <div className="flex items-center gap-1" role="navigation" aria-label="Quick actions">
              {calendarUrl ? (
                <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                  <a href={calendarUrl} target="_top" aria-label="Open scheduling calendar">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Calendar</span>
                  </a>
                </Button>
              ) : null}
              {recallsUrl ? (
                <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                  <a href={recallsUrl} target="_top" aria-label="View patient recalls">
                    <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Recalls</span>
                  </a>
                </Button>
              ) : null}
            </div>
          )}
        </div>
      }
    />
  );
}
