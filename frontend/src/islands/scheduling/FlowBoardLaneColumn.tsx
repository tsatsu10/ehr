import { useEffect, useState } from 'react';
import type { FlowBoardCard, FlowBoardLane, SchedulingFilters, SchedulingLabels } from './schedulingTypes';
import { recallsUrlForPatient } from './schedulingShellUtils';

function alertClass(level: FlowBoardCard['alert_level']): string {
  if (level === 'over') return 'oe-nc-flowboard-card--alert-over';
  if (level === 'warn') return 'oe-nc-flowboard-card--alert-warn';
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
      className={`oe-nc-flowboard-card border rounded p-2 mb-2 bg-white ${alertClass(card.alert_level)}${draggable ? ' oe-nc-flowboard-card--draggable' : ''}`}
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
      <div className="d-flex justify-content-between align-items-start">
        <strong className="small">{card.patient_name}</strong>
        {card.appt_time_label && (
          <span className="text-muted small">{card.appt_time_label}</span>
        )}
      </div>
      <div className="text-muted small d-flex flex-wrap align-items-center">
        <span>{card.category_label}</span>
        {showRoomEditor ? (
          <label className="oe-nc-flowboard-room mb-0 ml-2 d-inline-flex align-items-center">
            <span className="sr-only">{labels.roomFor} {card.patient_name}</span>
            <span className="mr-1">{labels.flowBoardRoomPrefix}</span>
            <input
              type="text"
              className="form-control form-control-sm oe-nc-flowboard-room__input"
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
        <div className="small mt-1">
          {card.minutes_in_status}
          m in
          {' '}
          {card.status_label}
        </div>
      )}
      {card.queue_bridge_ex01 && (
        <div className="small mt-1">
          <span className="badge badge-warning">{labels.noClinicalVisit}</span>
          {card.queue_bridge_fix_url && (
            <a className="ml-1" href={card.queue_bridge_fix_url}>{labels.fix}</a>
          )}
        </div>
      )}
      {card.is_recurring && (
        <div className="small text-muted mt-1">{labels.recurringTrackerDisabled}</div>
      )}
      <div className="mt-2 d-flex flex-wrap">
        {showCheckIn && (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary mr-1 mb-1"
            disabled={busy}
            onClick={() => onCheckIn(card.check_in_status as string)}
          >
            {labels.flowBoardCheckIn}
          </button>
        )}
        {card.next_status && canAdvance && !card.is_recurring && (
          <button
            type="button"
            className="btn btn-sm btn-primary mr-1 mb-1"
            disabled={busy}
            onClick={() => onAdvance(card.next_status as string)}
          >
            {labels.flowBoardNext}
          </button>
        )}
        <a className="btn btn-sm btn-link mb-1 p-0 align-self-center" href={frontDeskUrl}>
          {labels.frontDesk}
        </a>
        <a
          className="btn btn-sm btn-link mb-1 p-0 align-self-center ml-2"
          href={recallsUrlForPatient(moduleUrl, filters, card.pid)}
        >
          {labels.crossLinkViewRecalls}
        </a>
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
      className={`oe-nc-flowboard-lane${mobileAccordion ? ' oe-nc-flowboard-lane--accordion' : ''}${collapsed ? ' oe-nc-flowboard-lane--collapsed' : ''}`}
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
      <header className="oe-nc-flowboard-lane__head mb-2 d-flex align-items-center justify-content-between">
        <button
          type="button"
          className="btn btn-link btn-sm p-0 oe-nc-flowboard-lane__toggle"
          aria-expanded={!collapsed}
          onClick={onToggleCollapse}
        >
          <strong>{lane.label}</strong>
          <span className="text-muted small ml-1">({lane.count})</span>
        </button>
        {!mobileAccordion && (
          <span className="oe-nc-flowboard-lane__reorder btn-group btn-group-sm">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              aria-label={labels.moveLaneLeft}
              onClick={() => onMoveLane(lane.status, -1)}
            >
              ←
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              aria-label={labels.moveLaneRight}
              onClick={() => onMoveLane(lane.status, 1)}
            >
              →
            </button>
          </span>
        )}
      </header>
      {!collapsed && (
      <div
        className={`oe-nc-flowboard-lane__cards${dragOver ? ' oe-nc-flowboard-lane__cards--drag-over' : ''}`}
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
          <p className="text-muted small mb-0">{labels.flowBoardNoPatients}</p>
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
