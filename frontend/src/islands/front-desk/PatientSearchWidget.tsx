import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@components/ui/command';
import { Badge, badgeVariants } from '@components/ui/badge';
import { Card } from '@components/ui/card';
import { Avatar, AvatarFallback } from '@components/ui/avatar';
import { Button } from '@components/ui/button';
import { LiveRegion, useLiveAnnounce } from '@components/LiveRegion';
import { VirtualizedSearchResults } from '@components/VirtualizedSearchResults';
import { usePatientSearch } from '@core/usePatientSearch';
import { useTypeAheadSuggestions } from './useTypeAheadSuggestions';
import type { PatientSearchRow } from '@core/types';
import { cn } from '@/lib/utils';
import { completionVariant, initialsFromName } from './frontDeskUtils';
import { SearchResultSkeleton } from './SearchResultSkeleton';
import { RecentlyViewed } from './RecentlyViewed';
import { TodaysAppointmentsList } from './TodaysAppointmentsList';
import type { RecentPatient } from '@core/useRecentlyViewedPatients';
import type { TodaysAppointmentRow } from '@core/types';
import { UserPlus, X, Check, CalendarCheck, Search, BellRing, Sparkles, Zap } from 'lucide-react';

// Virtual scrolling threshold: use virtualization for result sets > 50
const VIRTUALIZATION_THRESHOLD = 50;

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
  onBulkCheckIn?: (pids: number[]) => Promise<void>;
}

const COMPLETION_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  success: 'success',
  warning: 'warning',
  danger:  'danger',
};

const AVATAR_PALETTE: readonly { bg: string; text: string }[] = [
  { bg: '#dbeafe', text: '#1e40af' }, // blue-100 / blue-800
  { bg: '#dcfce7', text: '#166534' }, // green-100 / green-800
  { bg: '#fce7f3', text: '#9d174d' }, // pink-100 / pink-800
  { bg: '#ede9fe', text: '#5b21b6' }, // violet-100 / violet-800
  { bg: '#ffedd5', text: '#9a3412' }, // orange-100 / orange-800
  { bg: '#fef9c3', text: '#854d0e' }, // yellow-100 / yellow-800
  { bg: '#cffafe', text: '#155e75' }, // cyan-100 / cyan-800
];

function nameToAvatarColor(name: string): { bg: string; text: string } {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

const SearchResultRow = memo(function SearchResultRow({
  patient,
  selectedPid,
  sharedPhone,
}: {
  patient: PatientSearchRow;
  selectedPid: number | null;
  sharedPhone?: boolean;
}) {
  const ageLabel = patient.dob_estimated
    ? `~${patient.age_years ?? '—'}`
    : (patient.age_years ?? '—');
  const secondary = [
    patient.sex || '—',
    ageLabel,
    patient.phone_masked || '—',
    `MRN ${patient.pubpid || '—'}`,
  ].join(' · ');

  const isSelected = selectedPid === patient.pid;
  const completionScore = patient.completion_score ?? 0;
  const compVariant = COMPLETION_BADGE_VARIANT[completionVariant(completionScore)] ?? 'neutral';
  const activeVisit = patient.active_visit ?? null;
  const appointmentToday = patient.chips?.appointment_today;
  const recallDue = patient.chips?.recall_due;
  const lastVisit = patient.last_visit_label;

  const avatarColor = nameToAvatarColor(patient.display_name);

  return (
    <div className="flex w-full min-w-0 items-center gap-2.5">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback
          className="text-xs font-semibold"
          style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
        >
          {initialsFromName(patient.display_name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {patient.display_name}
          {patient.dob_estimated && (
            <span className="ml-1.5 text-[0.6875rem] font-normal text-[var(--oe-nc-text-muted)]">est. age</span>
          )}
        </div>
        <div className="truncate text-xs text-[var(--oe-nc-text-muted)]">
          {secondary}
        </div>
        {activeVisit?.chief_complaint && (
          <div className="truncate text-xs text-[var(--oe-nc-text-muted)] italic mt-0.5">
            CC: {activeVisit.chief_complaint}
          </div>
        )}
        {!activeVisit && lastVisit && (
          <div className="truncate text-xs text-[var(--oe-nc-text-muted)] mt-0.5">
            Last visit: {lastVisit}
          </div>
        )}
      </div>

      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
        {activeVisit && (
          <Badge variant="info">
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

        {!activeVisit && recallDue && (
          <a
            href={recallDue.worklist_url}
            target="_top"
            title={recallDue.reason || recallDue.label}
            className={cn(badgeVariants({ variant: 'warning' }), 'no-underline hover:opacity-90')}
          >
            <BellRing className="h-3 w-3" />
            {recallDue.label}
          </a>
        )}

        {sharedPhone && patient.phone_masked && (
          <Badge
            variant="warning"
            className="tabular-nums"
            title="Another patient in these results shares this phone number"
          >
            Shared phone
          </Badge>
        )}

        <Badge variant={compVariant} className="tabular-nums">
          {completionScore}%
        </Badge>

        {isSelected && (
          <span>
            <Check className="h-4 w-4 text-[var(--oe-nc-primary)]" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
});

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
  onBulkCheckIn,
}: PatientSearchWidgetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previousResults, setPreviousResults] = useState<PatientSearchRow[]>([]);
  const { message, politeness, announce } = useLiveAnnounce();
  
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

  // Get instant type-ahead suggestions from cached data
  const typeAheadSuggestions = useTypeAheadSuggestions({
    query,
    recentPatients,
    todaysAppointments,
    previousResults,
    maxSuggestions: 5,
  });

  // Cache results for type-ahead
  useEffect(() => {
    if (results.length > 0) {
      setPreviousResults((prev) => {
        const newResults = [...results];
        // Merge with previous, keeping unique PIDs
        const merged = [...newResults, ...prev];
        const unique = merged.filter(
          (r, i, arr) => arr.findIndex((x) => x.pid === r.pid) === i
        );
        // Keep only last 50 results
        return unique.slice(0, 50);
      });
    }
  }, [results]);

  useEffect(() => {
    onResultsChange?.(results);
  }, [onResultsChange, results]);

  // Announce search results to screen readers
  useEffect(() => {
    if (query.length >= 2 && !searching) {
      if (error) {
        announce('Error loading search results', { politeness: 'assertive' });
      } else if (results.length === 0) {
        announce('No patients found', { politeness: 'polite' });
      } else {
        const count = results.length;
        const plural = count === 1 ? 'patient' : 'patients';
        announce(`${count} ${plural} found`, { politeness: 'polite' });
      }
    }
  }, [results, searching, query, error, announce]);

  // Announce type-ahead suggestions
  useEffect(() => {
    if (typeAheadSuggestions.length > 0 && query.length >= 1) {
      const count = typeAheadSuggestions.length;
      const plural = count === 1 ? 'suggestion' : 'suggestions';
      announce(`${count} quick ${plural} available`, { politeness: 'polite', clearAfter: 3000 });
    }
  }, [typeAheadSuggestions.length, query, announce]);

  // Announce appointments loading
  useEffect(() => {
    if (!appointmentsLoading && todaysAppointments.length > 0 && query.length === 0) {
      const count = todaysAppointments.length;
      const plural = count === 1 ? 'appointment' : 'appointments';
      announce(`${count} ${plural} scheduled for today`, { politeness: 'polite', clearAfter: 4000 });
    }
  }, [appointmentsLoading, todaysAppointments.length, query, announce]);

  // M1a-F01 — auto-focus search on desk load (slight delay lets React paint the card first)
  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

  const showEmptyResults = !searching && results.length === 0 && query.length >= 2;
  const showIdleState = !searching && results.length === 0 && query.length < 2;

  const sharedPhoneSet = useMemo(() => new Set<string>(
    results
      .map((r) => r.phone_masked?.trim() ?? '')
      .filter((p, _i, arr) => p.length > 0 && arr.filter((x) => x === p).length > 1)
  ), [results]);

  return (
    <Card
      id="nc-patient-search"
      className="nc-search-panel nc-patient-search overflow-hidden"
      aria-label="Patient search"
    >
      <Command shouldFilter={false} className="nc-desk-split-search nc-search-results flex flex-col">
        <div className="nc-search-hero px-3.5 pt-3.5 pb-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oe-nc-text-muted)] pointer-events-none">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <CommandInput
              ref={inputRef}
              id="nc-search-input"
              hideSearchIcon
              wrapperClassName="border-0 p-0"
              placeholder="Search patient by name"
              value={query}
              onValueChange={handleInput}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  clearSearch();
                  inputRef.current?.focus();
                }
              }}
              className="nc-search-hero-input h-11 pl-10 pr-10 text-base"
            />
            {searching && (
              <span
                className="nc-search-input-spinner"
                id="nc-search-spinner"
                role="status"
                aria-label="Searching"
              />
            )}
            {query && !searching && (
              <button
                type="button"
                className="nc-search-input-clear absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center h-9 w-9 rounded-full hover:bg-[var(--oe-nc-bg-tint)] transition-colors"
                id="nc-search-input-clear"
                aria-label="Clear search"
                onClick={() => {
                  clearSearch();
                  inputRef.current?.focus();
                }}
              >
                <X className="h-4 w-4 text-[var(--oe-nc-text-muted)]" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 mt-2">
            <p className="text-xs text-[var(--oe-nc-text-muted)] leading-none m-0" id="nc-search-hint">
              Type ≥ 2 characters · press <kbd className="nc-kbd">/</kbd> to focus
            </p>
            {showRegisterButton && (
              <Button
                variant="outline"
                size="sm"
                id="nc-add-patient"
                className="h-9 text-xs px-3"
                onClick={() => onRegisterPatient(query.trim())}
              >
                <UserPlus className="h-4 w-4" />
                Register
              </Button>
            )}
          </div>

          {error && (
            <div className="nc-inline-error mt-2 px-3 py-2 rounded-lg text-sm" id="nc-search-error" role="alert">
              {error}
            </div>
          )}
        </div>

        {/* Type-ahead quick suggestions - instant matches from cache */}
        {query.length >= 1 && typeAheadSuggestions.length > 0 && (searching || results.length === 0) && (
          <CommandGroup heading={
            <div className="flex items-center gap-1.5 text-xs text-[var(--oe-nc-text-muted)]">
              <Zap className="h-3 w-3 text-amber-500" aria-hidden="true" />
              <span>Quick suggestions</span>
            </div>
          }>
            {typeAheadSuggestions.map((suggestion) => (
              <CommandItem
                key={`typeahead-${suggestion.pid}`}
                value={`${suggestion.displayName}-${suggestion.pubpid}`}
                onSelect={() => onSelectPatient(suggestion.pid)}
                className="nc-search-result-item cursor-pointer px-3 py-2.5"
              >
                <div className="flex w-full min-w-0 items-center gap-2.5">
                  <Avatar className="h-9 w-9 shrink-0 opacity-90">
                    <AvatarFallback
                      className="text-xs font-semibold"
                      style={{ 
                        backgroundColor: nameToAvatarColor(suggestion.displayName).bg, 
                        color: nameToAvatarColor(suggestion.displayName).text 
                      }}
                    >
                      {initialsFromName(suggestion.displayName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {suggestion.displayName}
                    </div>
                    <div className="truncate text-xs text-[var(--oe-nc-text-muted)]">
                      {suggestion.match}
                    </div>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <Badge 
                      variant={suggestion.source === 'recent' ? 'neutral' : suggestion.source === 'appointment' ? 'info' : 'ghost'}
                      className="text-[0.6875rem]"
                    >
                      {suggestion.source === 'recent' ? 'Recent' : suggestion.source === 'appointment' ? 'Today' : 'Cached'}
                    </Badge>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

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
            onBulkCheckIn={onBulkCheckIn}
          />
        )}

        {showIdleState && (
          <div
            className="nc-search-idle border-t border-(--oe-nc-border) px-4 py-8 text-center text-sm text-(--oe-nc-text-muted)"
            id="nc-search-idle-hint"
            role="status"
          >
            <div
              className="mb-3 mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-(--oe-nc-bg-tint) text-(--oe-nc-text-muted)"
              aria-hidden="true"
            >
              <Search className="h-4 w-4" />
            </div>
            <p className="m-0 font-medium text-(--oe-nc-text)">
              {recentPatients.length > 0 || todaysAppointments.length > 0
                ? 'Pick from recent or appointments above'
                : 'Search to find a patient'}
            </p>
            <p className="m-0 mt-1 text-xs">
              {recentPatients.length > 0 || todaysAppointments.length > 0
                ? 'Or type ≥ 2 characters to search all patients.'
                : 'Type first name, last name, or both.'}
            </p>
          </div>
        )}

        <CommandList id="nc-search-results" aria-label="Search results" className="flex-1 min-h-0">
          {searching && <SearchResultSkeleton rows={3} />}
          {showEmptyResults && (
            <CommandEmpty id="nc-search-empty" className="py-8 text-center text-sm text-[var(--oe-nc-text-muted)]">
              No match — check spelling, or register a new patient.
            </CommandEmpty>
          )}
          {!searching && results.length > 0 && results.length > VIRTUALIZATION_THRESHOLD ? (
            // Virtual scrolling for large result sets (>50 items)
            <CommandGroup className="p-2">
              <VirtualizedSearchResults
                results={results}
                selectedPid={selectedPid}
                onSelectPatient={onSelectPatient}
                estimatedRowHeight={72}
                renderRow={(patient, isSelected) => (
                  <SearchResultRow
                    patient={patient}
                    selectedPid={selectedPid}
                    sharedPhone={!!(patient.phone_masked && sharedPhoneSet.has(patient.phone_masked.trim()))}
                  />
                )}
              />
            </CommandGroup>
          ) : !searching && results.length > 0 ? (
            // Standard rendering for small result sets (≤50 items)
            <CommandGroup className="p-2">
              {results.map((patient) => (
                <CommandItem
                  key={patient.pid}
                  value={`${patient.pid}-${patient.display_name}-${patient.pubpid}`}
                  className={cn(
                    'nc-search-row rounded-lg px-2 py-2',
                    'border-l-[3px] border-l-transparent transition-[background-color,border-color] duration-150',
                    selectedPid === patient.pid &&
                      'border-l-[var(--oe-nc-primary,#2563eb)] bg-[var(--oe-nc-bg,#eff6ff)]',
                    patient.active_visit &&
                      'border-l-[var(--oe-nc-primary,#2563eb)] bg-gradient-to-r from-[var(--oe-nc-bg,#eff6ff)] to-white hover:from-[var(--oe-nc-bg,#eff6ff)] hover:to-[var(--oe-nc-bg-tint,#f8fafc)]',
                  )}
                  onSelect={() => onSelectPatient(patient.pid)}
                >
                  <SearchResultRow
                    patient={patient}
                    selectedPid={selectedPid}
                    sharedPhone={!!(patient.phone_masked && sharedPhoneSet.has(patient.phone_masked.trim()))}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
        
        <LiveRegion message={message} politeness={politeness} />
      </Command>
    </Card>
  );
}
