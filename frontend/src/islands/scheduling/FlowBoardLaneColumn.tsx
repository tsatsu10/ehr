import { useEffect, useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import type { FlowBoardCard, FlowBoardLane, SchedulingFilters, SchedulingLabels } from './schedulingTypes';
import { recallsUrlForPatient } from './schedulingShellUtils';

function alertClass(level: FlowBoardCard['alert_level']): string {
  if (level === 'over') return 'nc-flowboard-card--alert-over';
  if (level === 'warn') return 'nc-flowboard-card--alert-warn';
  return '';
}

export function FlowBoardCardView({
  card,
  canAdvance,
  busy,
  frontDeskUrl,
  onAdvance,
  onCheckIn,
  onRoomChange,
  onDragStart,
  labels,
  moduleUrl,
  filters,
}: {
  card: FlowBoardCard;
  canAdvance: boolean;
  busy: boolean;
  frontDeskUrl: string;
  onAdvance: (status: string) => void;
  onCheckIn: (status: string) => void;
  onRoomChange: (room: string) => void;
  onDragStart: (pcEid: number) => void;
  labels: SchedulingLabels;
  moduleUrl: string;
  filters: SchedulingFilters;
}) {
  const showCheckIn = !card.has_tracker
    && !card.is_recurring
    && card.check_in_status
    && canAdvance;
  const [roomDraft, setRoomDraft] = useState(card.room);
  const showRoomEditor = canAdvance && !card.is_recurring;
  const draggable = canAdvance && !card.is_recurring && !busy;

  useEffect(() => {
    setRoomDraft(card.room);
  }, [card.room, card.pc_eid]);

  const commitRoom = () => {
    if (roomDraft.trim() === card.room.trim()) {
      return;
    }
    onRoomChange(roomDraft.trim());
  };

  return (
    <article
      className={`nc-flowboard-card border rounded p-2 mb-2 bg-white ${alertClass(card.alert_level)}${draggable ? ' nc-flowboard-card--draggable' : ''}`}
      aria-label={`${card.patient_name}, ${card.status_label}`}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) {
          return;
        }
        event.dataTransfer.setData('text/plain', String(card.pc_eid));
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(card.pc_eid);
      }}
    >
      <div className="flex justify-between items-start">
        <strong className="text-sm">{card.patient_name}</strong>
        {card.appt_time_label && (
          <span className="text-[var(--oe-nc-text-muted)] text-sm">{card.appt_time_label}</span>
        )}
      </div>
      <div className="text-[var(--oe-nc-text-muted)] text-sm flex flex-wrap items-center">
        <span>{card.category_label}</span>
        {showRoomEditor ? (
          <label className="nc-flowboard-room mb-0 ml-2 inline-flex items-center">
            <span className="sr-only">{labels.roomFor} {card.patient_name}</span>
            <span className="mr-1">{labels.flowBoardRoomPrefix}</span>
            <Input
              type="text"
              className="h-8 nc-flowboard-room-input"
              value={roomDraft}
              maxLength={20}
              disabled={busy}
              onChange={(event) => setRoomDraft(event.target.value)}
              onBlur={commitRoom}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
        ) : card.room ? (
          <span className="ml-1">· {labels.flowBoardRoomPrefix} {card.room}</span>
        ) : null}
      </div>
      {card.minutes_in_status > 0 && (
        <div className="text-sm mt-1">
          {card.minutes_in_status}
          m in
          {' '}
          {card.status_label}
        </div>
      )}
      {card.queue_bridge_ex01 && (
        <div className="text-sm mt-1">
          <Badge variant="warning">{labels.noClinicalVisit}</Badge>
          {card.queue_bridge_fix_url && (
            <a className="ml-1" href={card.queue_bridge_fix_url}>{labels.fix}</a>
          )}
        </div>
      )}
      {card.is_recurring && (
        <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">{labels.recurringTrackerDisabled}</div>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {showCheckIn && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onCheckIn(card.check_in_status as string)}
          >
            {labels.flowBoardCheckIn}
          </Button>
        )}
        {card.next_status && canAdvance && !card.is_recurring && (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => onAdvance(card.next_status as string)}
          >
            {labels.flowBoardNext}
          </Button>
        )}
        <Button variant="link" size="sm" className="h-auto p-0 self-center" asChild>
          <a href={frontDeskUrl}>
            {labels.frontDesk}
          </a>
        </Button>
        <Button variant="link" size="sm" className="h-auto p-0 self-center ml-2" asChild>
          <a href={recallsUrlForPatient(moduleUrl, filters, card.pid)}>
            {labels.crossLinkViewRecalls}
          </a>
        </Button>
      </div>
    </article>
  );
}

export function FlowBoardLaneColumn({
  lane,
  canAdvance,
  busyEid,
  frontDeskUrl,
  dragOver,
  collapsed,
  mobileAccordion,
  onToggleCollapse,
  onAdvance,
  onCheckIn,
  onRoomChange,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDrop,
  onMoveLane,
  onReorderLane,
  labels,
  moduleUrl,
  filters,
}: {
  lane: FlowBoardLane;
  canAdvance: boolean;
  busyEid: number | null;
  frontDeskUrl: string;
  dragOver: boolean;
  collapsed: boolean;
  mobileAccordion: boolean;
  onToggleCollapse: () => void;
  onAdvance: (pcEid: number, status: string) => void;
  onCheckIn: (pcEid: number, status: string) => void;
  onRoomChange: (pcEid: number, room: string) => void;
  onDragStart: (pcEid: number) => void;
  onDragEnter: (status: string) => void;
  onDragLeave: () => void;
  onDrop: (status: string, pcEid: number) => void;
  onMoveLane: (status: string, delta: -1 | 1) => void;
  onReorderLane: (fromStatus: string, toStatus: string) => void;
  labels: SchedulingLabels;
  moduleUrl: string;
  filters: SchedulingFilters;
}) {
  return (
    <section
      className={`nc-flowboard-lane${mobileAccordion ? ' nc-flowboard-lane--accordion' : ''}${collapsed ? ' nc-flowboard-lane--collapsed' : ''}`}
      aria-label={lane.label}
      draggable={!mobileAccordion}
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-nc-lane', lane.status);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const fromStatus = event.dataTransfer.getData('application/x-nc-lane');
        if (fromStatus) {
          onReorderLane(fromStatus, lane.status);
        }
      }}
    >
      <header className="nc-flowboard-lane-head mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="nc-flowboard-lane-toggle h-auto p-0"
          aria-expanded={!collapsed}
          onClick={onToggleCollapse}
        >
          <strong>{lane.label}</strong>
          <span className="text-[var(--oe-nc-text-muted)] text-sm ml-1">({lane.count})</span>
        </Button>
        {!mobileAccordion && (
          <span className="nc-flowboard-lane-reorder inline-flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={labels.moveLaneLeft}
              onClick={() => onMoveLane(lane.status, -1)}
            >
              ←
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={labels.moveLaneRight}
              onClick={() => onMoveLane(lane.status, 1)}
            >
              →
            </Button>
          </span>
        )}
      </header>
      {!collapsed && (
      <div
        className={`nc-flowboard-lane-cards${dragOver ? ' nc-flowboard-lane-cards--drag-over' : ''}`}
        role="list"
        onDragOver={(event) => {
          if (!canAdvance) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDragEnter={() => onDragEnter(lane.status)}
        onDragLeave={onDragLeave}
        onDrop={(event) => {
          event.preventDefault();
          const laneDrag = event.dataTransfer.getData('application/x-nc-lane');
          if (laneDrag) {
            onReorderLane(laneDrag, lane.status);
            return;
          }
          const raw = event.dataTransfer.getData('text/plain');
          const pcEid = Number(raw);
          if (pcEid > 0) {
            onDrop(lane.status, pcEid);
          }
        }}
      >
        {lane.cards.length === 0 && (
          <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">{labels.flowBoardNoPatients}</p>
        )}
        {lane.cards.map((card) => (
          <div key={card.pc_eid} role="listitem">
            <FlowBoardCardView
              card={card}
              canAdvance={canAdvance}
              busy={busyEid === card.pc_eid}
              frontDeskUrl={frontDeskUrl}
              labels={labels}
              onAdvance={(status) => onAdvance(card.pc_eid, status)}
              onCheckIn={(status) => onCheckIn(card.pc_eid, status)}
              onRoomChange={(room) => onRoomChange(card.pc_eid, room)}
              onDragStart={onDragStart}
              moduleUrl={moduleUrl}
              filters={filters}
            />
          </div>
        ))}
      </div>
      )}
    </section>
  );
}
