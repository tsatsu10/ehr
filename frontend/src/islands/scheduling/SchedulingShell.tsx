import { useCallback, useEffect, useMemo, useState } from 'react';
import { SegmentedControl } from '@components/SegmentedControl';
import { Button } from '@components/ui/button';
import { WidgetCard } from '@components/WidgetCard';
import { usePageHeadingRefresh, usePageHeadingUpdated } from '@core/usePageHeadingToolbar';
import { SchedulingFilterBar } from './SchedulingFilterBar';
import { CalendarLens } from './CalendarLens';
import { FlowBoardLens } from './FlowBoardLens';
import { RecallsLens } from './RecallsLens';
import {
  type SchedulingLens,
  type SchedulingProps,
} from './schedulingTypes';
import { useSchedulingUrlState } from './useSchedulingUrlState';
import { resolveSchedulingLabels } from './schedulingLabels';
import {
  defaultCalendarLayout,
  localTodayIso,
  readStoredCalendarLayout,
  shiftDate,
  storeCalendarLayout,
  type CalendarLayout,
  type DateStepUnit,
} from './schedulingCalendarUtils';
import './main.css';

const SHORTCUT_LAYOUTS: Record<string, CalendarLayout> = {
  a: 'agenda',
  d: 'day',
  w: 'week',
  m: 'month',
};

const LENSES: SchedulingLens[] = ['calendar', 'flow', 'recalls'];

export function SchedulingShell(props: SchedulingProps) {
  const initialFilters = useMemo(() => ({
    facilityId: props.facilityId,
    providerId: props.initialProviderId,
    date: props.initialDate,
  }), [props.facilityId, props.initialDate, props.initialProviderId]);

  const { lens, setLens, filters, setFilters, summaryLine, filterPid } = useSchedulingUrlState({
    initialLens: props.initialLens,
    initialFilters,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [refreshToken, setRefreshToken] = useState(0);
  const [bookSignal, setBookSignal] = useState(0);
  const [newRecallSignal, setNewRecallSignal] = useState(0);
  // Mirror of CalendarLens's active layout so the filter-bar date stepper
  // moves by the unit the user is looking at (day/week/month). Restored from
  // the user's last-used view so the page reopens where they left it.
  const [calendarLayout, setCalendarLayoutState] = useState<CalendarLayout>(
    () => readStoredCalendarLayout() ?? defaultCalendarLayout(),
  );
  const setCalendarLayout = useCallback((next: CalendarLayout) => {
    storeCalendarLayout(next);
    setCalendarLayoutState(next);
  }, []);
  const labels = resolveSchedulingLabels(props.labels);

  const stepUnit: DateStepUnit = lens !== 'calendar' ? 'day'
    : calendarLayout === 'week' ? 'week'
      : calendarLayout === 'month' ? 'month'
        : 'day';

  const segments = useMemo(
    () => LENSES.map((id) => ({
      id,
      label: id === 'calendar' ? labels.lensCalendar
        : id === 'flow' ? labels.lensFlow
          : labels.lensRecalls,
    })),
    [labels],
  );

  const refresh = useCallback(() => {
    setLastUpdated(new Date());
    setRefreshToken((value) => value + 1);
  }, []);

  usePageHeadingUpdated('nc-scheduling-updated', lastUpdated);
  usePageHeadingRefresh('nc-scheduling-refresh', refresh);

  useEffect(() => {
    const summaryEl = document.getElementById('nc-scheduling-summary');
    if (summaryEl) {
      summaryEl.textContent = summaryLine;
    }
  }, [summaryLine]);

  // Keyboard shortcuts (S1 spec §6.2): t today, n new booking, ←/→ step the
  // period, a/d/w/m switch calendar view. Never fire while typing, while a
  // dialog/sheet is open, or when the day grid already handled an arrow for
  // cell focus (it preventDefaults those).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && (
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
        || target.isContentEditable
        || target.hasAttribute('data-grid-slot')
      )) {
        return;
      }
      // Only a VISIBLE dialog should swallow shortcuts. The Twig shell keeps a
      // permanently-mounted role-switch modal (aria-hidden when closed) in the
      // DOM, so a bare [role=dialog] check would disable shortcuts forever.
      const openDialog = [...document.querySelectorAll('[role="dialog"]')]
        .some((el) => el.getAttribute('aria-hidden') !== 'true' && (el as HTMLElement).offsetParent !== null);
      if (openDialog) {
        return;
      }

      const key = event.key;
      if (key === 't') {
        setFilters({ date: localTodayIso() });
      } else if (key === 'ArrowLeft') {
        setFilters({ date: shiftDate(filters.date, stepUnit, -1) });
      } else if (key === 'ArrowRight') {
        setFilters({ date: shiftDate(filters.date, stepUnit, 1) });
      } else if (key === 'n' && lens === 'calendar' && props.canBook) {
        setBookSignal((value) => value + 1);
      } else if (lens === 'calendar' && SHORTCUT_LAYOUTS[key]) {
        setCalendarLayout(SHORTCUT_LAYOUTS[key]);
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filters.date, lens, props.canBook, setCalendarLayout, setFilters, stepUnit]);

  return (
    <div className="nc-scheduling" id="nc-scheduling-root">
      {/* Console 26 layout: the Twig page heading carries the 30px title; the
          lens switcher + primary action sit on their own toolbar row directly
          under it (artifact topbar composition), and the lens content lives in
          its own card on the grey ground. */}
      <div className="nc-scheduling-toolbar mb-3 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          segments={segments}
          value={lens}
          onChange={(id) => setLens(id as SchedulingLens)}
          ariaLabel="Scheduling lenses"
        />
        <Button
          type="button"
          size="sm"
          disabled={!props.canBook}
          title={
            lens === 'recalls'
              ? (props.canBook ? labels.createRecallTooltip : labels.requiresAclTooltip)
              : (props.canBook ? labels.bookTooltip : labels.requiresAclTooltip)
          }
          onClick={() => {
            if (lens === 'recalls') {
              setNewRecallSignal((value) => value + 1);
            } else {
              setBookSignal((value) => value + 1);
            }
          }}
        >
          {lens === 'recalls' ? `+ ${labels.newRecall}` : `+ ${labels.bookAppointment}`}
        </Button>
      </div>

      <WidgetCard bodyPad="pad">
        <SchedulingFilterBar
          filters={filters}
          providers={props.providers}
          stepUnit={stepUnit}
          labels={labels}
          onChange={setFilters}
        />

        {lens === 'calendar' && (
          <CalendarLens
            ajaxUrl={props.ajaxUrl}
            csrfToken={props.csrfToken}
            filters={filters}
            refreshToken={refreshToken}
            bookSignal={bookSignal}
            frontDeskUrl={props.frontDeskUrl}
            layout={calendarLayout}
            onLayoutChange={setCalendarLayout}
            labels={labels}
          />
        )}
        {lens === 'flow' && (
          <FlowBoardLens
            ajaxUrl={props.ajaxUrl}
            csrfToken={props.csrfToken}
            filters={filters}
            refreshToken={refreshToken}
            frontDeskUrl={props.frontDeskUrl}
            moduleUrl={props.moduleUrl}
            authUserId={props.authUserId}
            labels={labels}
          />
        )}
        {lens === 'recalls' && (
          <RecallsLens
            ajaxUrl={props.ajaxUrl}
            csrfToken={props.csrfToken}
            filters={filters}
            facilities={props.facilities}
            refreshToken={refreshToken}
            newRecallSignal={newRecallSignal}
            frontDeskUrl={props.frontDeskUrl}
            moduleUrl={props.moduleUrl}
            filterPid={filterPid}
            labels={labels}
          />
        )}
      </WidgetCard>
    </div>
  );
}
