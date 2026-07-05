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
import './main.css';

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
  const labels = resolveSchedulingLabels(props.labels);

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

  return (
    <div className="nc-scheduling" id="nc-scheduling-root">
      <WidgetCard title="Scheduling & Flow" bodyPad="pad">
        <SchedulingFilterBar
          filters={filters}
          facilities={props.facilities}
          providers={props.providers}
          labels={labels}
          onChange={setFilters}
        />

        <div className="flex flex-wrap items-center justify-between mb-3">
          <SegmentedControl
            segments={segments}
            value={lens}
            onChange={(id) => setLens(id as SchedulingLens)}
            ariaLabel="Scheduling lenses"
          />
          <Button
            type="button"
            size="sm"
            className="mt-2 md:mt-0"
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

        {lens === 'calendar' && (
          <CalendarLens
            ajaxUrl={props.ajaxUrl}
            csrfToken={props.csrfToken}
            filters={filters}
            refreshToken={refreshToken}
            bookSignal={bookSignal}
            frontDeskUrl={props.frontDeskUrl}
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
