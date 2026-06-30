import { useEffect, useRef } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@components/ui/command';
import { Badge } from '@components/ui/badge';
import { Avatar, AvatarFallback } from '@components/ui/avatar';
import { Button } from '@components/ui/button';
import { usePatientSearch } from '@core/usePatientSearch';
import type { PatientSearchRow } from '@core/types';
import { cn } from '@/lib/utils';
import { completionVariant, initialsFromName } from './frontDeskUtils';
import { SearchResultSkeleton } from './SearchResultSkeleton';
import { RecentlyViewed } from './RecentlyViewed';
import { TodaysAppointmentsList } from './TodaysAppointmentsList';
import type { RecentPatient } from '@core/useRecentlyViewedPatients';
import type { TodaysAppointmentRow } from '@core/types';
import { UserPlus, X, Check, CalendarCheck, Search } from 'lucide-react';

interface PatientSearchWidgetProps {
  ajaxUrl: string;
  csrfToken: string;
  selectedPid: number | null;
  initialQuery?: string;
  autoSelectFirst?: boolean;
  showRegisterButton?: boolean;
  recentPatients?: RecentPatient[];
  onClearRecent?: () => void;
  schedulingEnabled?: boolean;
  todaysAppointments?: TodaysAppointmentRow[];
  appointmentsLoading?: boolean;
  onSelectPatient: (pid: number) => void;
  onRegisterPatient: (prefill?: string) => void;
  onResultsChange?: (results: PatientSearchRow[]) => void;
}

const COMPLETION_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  success: 'success',
  warning: 'warning',
  danger:  'danger',
};

function SearchResultRow({
  patient,
  selectedPid,
}: {
  patient: PatientSearchRow;
  selectedPid: number | null;
}) {
  const secondary = [
    patient.sex || '—',
    patient.age_years ?? '—',
    patient.phone_masked || '—',
    `MRN ${patient.pubpid || '—'}`,
  ].join(' · ');

  const isSelected = selectedPid === patient.pid;
  const completionScore = patient.completion_score ?? 0;
  const compVariant = COMPLETION_BADGE_VARIANT[completionVariant(completionScore)] ?? 'neutral';
  const activeVisit = patient.active_visit ?? null;
  const appointmentToday = patient.chips?.appointment_today;

  return (
    <div className="oe-nc-search-row__inner">
      <Avatar className="oe-nc-search-row__avatar h-9 w-9 shrink-0">
        <AvatarFallback className="text-xs font-semibold">
          {initialsFromName(patient.display_name)}
        </AvatarFallback>
      </Avatar>

      <div className="oe-nc-search-row__identity min-w-0 flex-1">
        <div className="oe-nc-search-row__name font-semibold text-sm truncate">
          {patient.display_name}
        </div>
        <div className="oe-nc-search-row__meta text-xs text-[var(--oe-nc-text-muted)] truncate">
          {secondary}
        </div>
      </div>

      <div className="oe-nc-search-row__chips flex items-center gap-1.5 shrink-0 flex-wrap">
        {activeVisit && (
          <Badge variant="info" className="oe-nc-search-row__active-visit">
            <span className="block h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
            {`In queue · #${activeVisit.queue_number}`}
          </Badge>
        )}

        {!activeVisit && appointmentToday && (
          <Badge variant="info">
            <CalendarCheck className="h-3 w-3" />
            Today
          </Badge>
        )}

        <Badge variant={compVariant} className="tabular-nums">
          {completionScore}%
        </Badge>

        {isSelected && (
          <span className="oe-nc-search-row__check">
            <Check className="h-4 w-4 text-[var(--oe-nc-primary)]" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}

export function PatientSearchWidget({
  ajaxUrl,
  csrfToken,
  selectedPid,
  initialQuery = '',
  autoSelectFirst = true,
  showRegisterButton = true,
  recentPatients = [],
  onClearRecent,
  schedulingEnabled = false,
  todaysAppointments = [],
  appointmentsLoading = false,
  onSelectPatient,
  onRegisterPatient,
  onResultsChange,
}: PatientSearchWidgetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    query,
    results,
    searching,
    error,
    handleInput,
    clearSearch,
  } = usePatientSearch({
    ajaxUrl,
    csrfToken,
    autoSelectFirst,
    initialQuery,
    onSelectPatient,
  });

  useEffect(() => {
    onResultsChange?.(results);
  }, [onResultsChange, results]);

  const showEmptyResults = !searching && results.length === 0 && query.length >= 2;
  const showIdleState = !searching && results.length === 0 && query.length < 2;

  return (
    <section
      id="nc-patient-search"
      className="oe-nc-search-panel nc-patient-search rounded-xl border border-[var(--oe-nc-border)] bg-white shadow-[var(--shadow-sm)] overflow-hidden"
      aria-label="Patient search"
    >
      <Command shouldFilter={false} className="oe-nc-desk-split__search nc-search-results flex flex-col">
        <div className="oe-nc-search-hero px-3.5 pt-3.5 pb-2">
          <div className="oe-nc-command__input-row relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oe-nc-text-muted)] pointer-events-none">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <CommandInput
              ref={inputRef}
              id="nc-search-input"
              placeholder="Search patient — name, phone, NHIS, National ID, MRN"
              value={query}
              onValueChange={handleInput}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  clearSearch();
                  inputRef.current?.focus();
                }
              }}
              className="oe-nc-search-hero__input h-11 pl-10 pr-10 text-base"
            />
            {searching && (
              <span
                className="oe-nc-search-input__spinner"
                id="nc-search-spinner"
                role="status"
                aria-label="Searching"
              />
            )}
            {query && !searching && (
              <button
                type="button"
                className="oe-nc-search-input__clear absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-6 w-6 rounded-full hover:bg-[var(--oe-nc-bg-tint)] transition-colors"
                id="nc-search-input-clear"
                aria-label="Clear search"
                onClick={() => {
                  clearSearch();
                  inputRef.current?.focus();
                }}
              >
                <X className="h-3.5 w-3.5 text-[var(--oe-nc-text-muted)]" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 mt-2">
            <p className="text-xs text-[var(--oe-nc-text-muted)] leading-none m-0" id="nc-search-hint">
              Type ≥ 2 characters · press <kbd className="oe-nc-kbd">/</kbd> to focus
            </p>
            {showRegisterButton && (
              <Button
                variant="outline"
                size="sm"
                id="nc-add-patient"
                className="h-7 text-xs"
                onClick={() => onRegisterPatient(query.trim())}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Register
              </Button>
            )}
          </div>

          {error && (
            <div className="oe-nc-inline-error mt-2 px-3 py-2 rounded-lg text-sm" id="nc-search-error" role="alert">
              {error}
            </div>
          )}
        </div>

        {recentPatients.length > 0 && query.length < 2 && (
          <RecentlyViewed
            patients={recentPatients}
            onSelect={onSelectPatient}
            onClear={() => onClearRecent?.()}
          />
        )}

        {schedulingEnabled && query.length < 2 && (
          <TodaysAppointmentsList
            appointments={todaysAppointments}
            loading={appointmentsLoading}
            onSelect={onSelectPatient}
          />
        )}

        <CommandList id="nc-search-results" aria-label="Search results" className="flex-1 min-h-0">
          {searching && <SearchResultSkeleton rows={3} />}
          {showEmptyResults && (
            <CommandEmpty id="nc-search-empty" className="py-8 text-center text-sm text-[var(--oe-nc-text-muted)]">
              No match — try phone or MRN, or register a new patient.
            </CommandEmpty>
          )}
          {showIdleState && (
            <div
              className="oe-nc-command__idle px-4 py-4 text-center text-sm text-[var(--oe-nc-text-muted)]"
              id="nc-search-idle-hint"
              role="status"
            >
              {recentPatients.length > 0 || todaysAppointments.length > 0
                ? 'Or start typing to search all patients.'
                : 'Start typing to find a patient.'}
            </div>
          )}
          {!searching && results.length > 0 && (
            <CommandGroup className="p-2">
              {results.map((patient) => (
                <CommandItem
                  key={patient.pid}
                  value={`${patient.pid}-${patient.display_name}-${patient.pubpid}`}
                  className={cn(
                    'nc-search-row oe-nc-search-row rounded-lg px-2 py-2 cursor-pointer',
                    selectedPid === patient.pid && 'oe-nc-search-row--selected',
                    patient.active_visit && 'oe-nc-search-row--active-visit',
                  )}
                  onSelect={() => onSelectPatient(patient.pid)}
                >
                  <SearchResultRow patient={patient} selectedPid={selectedPid} />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </section>
  );
}
