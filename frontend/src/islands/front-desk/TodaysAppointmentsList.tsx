import { useState, useCallback } from 'react';
import { CalendarDays, CheckSquare, Square, PlayCircle, Loader2 } from 'lucide-react';
import type { TodaysAppointmentRow } from '@core/types';
import { Button } from '@components/ui/button';

interface TodaysAppointmentsListProps {
  appointments: TodaysAppointmentRow[];
  loading?: boolean;
  onSelect: (pid: number) => void;
  onBulkCheckIn?: (pids: number[]) => Promise<void>;
}

export function TodaysAppointmentsList({
  appointments,
  loading = false,
  onSelect,
  onBulkCheckIn,
}: TodaysAppointmentsListProps) {
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ ok: number; fail: number } | null>(null);

  const toggleSelect = useCallback((pid: number) => {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
    setBulkResult(null);
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedPids((prev) => {
      if (prev.size === appointments.length) return new Set();
      return new Set(appointments.map((a) => a.pid));
    });
    setBulkResult(null);
  }, [appointments]);

  const handleBulkCheckIn = useCallback(async () => {
    if (!onBulkCheckIn || selectedPids.size === 0) return;
    setBulkSubmitting(true);
    setBulkResult(null);
    try {
      await onBulkCheckIn(Array.from(selectedPids));
      setBulkResult({ ok: selectedPids.size, fail: 0 });
      setSelectedPids(new Set());
    } catch {
      setBulkResult({ ok: 0, fail: selectedPids.size });
    } finally {
      setBulkSubmitting(false);
    }
  }, [onBulkCheckIn, selectedPids]);

  if (loading && appointments.length === 0) {
    return (
      <div className="nc-todays-appts px-3 py-4 text-center text-sm text-[var(--oe-nc-text-muted)]" role="status">
        Loading today&apos;s schedule…
      </div>
    );
  }

  if (appointments.length === 0) {
    return null;
  }

  const allSelected = selectedPids.size === appointments.length;
  const someSelected = selectedPids.size > 0;

  return (
    <div className="nc-todays-appts border-t border-[var(--oe-nc-border)]">
      <div className="nc-todays-appts-header flex items-center gap-2 px-3 py-2 bg-[var(--oe-nc-bg-tint)]">
        {onBulkCheckIn && (
          <button
            type="button"
            className="shrink-0 flex items-center justify-center h-9 w-9 rounded text-[var(--oe-nc-text-muted)] hover:text-[var(--oe-nc-primary)] hover:bg-white/50 transition-colors"
            aria-label={allSelected ? 'Deselect all' : 'Select all appointments'}
            onClick={toggleAll}
          >
            {allSelected
              ? <CheckSquare className="h-5 w-5 text-[var(--oe-nc-primary)]" />
              : <Square className="h-5 w-5" />
            }
          </button>
        )}
        <CalendarDays className="h-3.5 w-3.5 text-[var(--oe-nc-text-muted)]" aria-hidden="true" />
        <span className="text-xs font-semibold text-[var(--oe-nc-text)] flex-1">
          Today&apos;s appointments
        </span>
        <span className="text-xs text-[var(--oe-nc-text-muted)] tabular-nums">{appointments.length}</span>
      </div>

      <ul className="nc-todays-appts-list list-none m-0 p-0" role="list">
        {appointments.map((row) => (
          <li key={`${row.pid}-${row.pc_eid}`} className="flex items-stretch">
            {onBulkCheckIn && (
              <button
                type="button"
                className="nc-bulk-select-col shrink-0 flex items-center justify-center w-11 border-b border-[var(--oe-nc-border)] hover:bg-[var(--oe-nc-bg-tint)] transition-colors"
                aria-label={selectedPids.has(row.pid) ? `Deselect ${row.display_name}` : `Select ${row.display_name}`}
                onClick={() => toggleSelect(row.pid)}
              >
                {selectedPids.has(row.pid)
                  ? <CheckSquare className="h-5 w-5 text-[var(--oe-nc-primary)]" />
                  : <Square className="h-5 w-5 text-[var(--oe-nc-text-muted)]" />
                }
              </button>
            )}
            <button
              type="button"
              className="nc-todays-appts-row flex-1 text-left px-3 py-2.5 border-b border-[var(--oe-nc-border)] last:border-b-0 hover:bg-[var(--oe-nc-bg-tint)] transition-colors"
              onClick={() => onSelect(row.pid)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="nc-todays-appts-time shrink-0 w-14 text-xs font-semibold tabular-nums text-[var(--oe-nc-text)]">
                  {row.start_time_label ?? '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--oe-nc-text)] truncate">
                    {row.display_name}
                  </span>
                  <span className="block text-xs text-[var(--oe-nc-text-muted)] truncate">
                    MRN {row.pubpid}
                    {row.provider_name ? ` · ${row.provider_name}` : ''}
                  </span>
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {onBulkCheckIn && someSelected && (
        <div className="nc-bulk-checkin-bar flex items-center gap-2 px-3 py-2 border-t border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint)]">
          <span className="text-xs text-[var(--oe-nc-text-muted)] flex-1">
            {selectedPids.size} selected
          </span>
          {bulkResult && (
            <span className={`text-xs font-medium ${bulkResult.fail > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {bulkResult.fail > 0
                ? `${bulkResult.fail} failed`
                : `${bulkResult.ok} checked in`
              }
            </span>
          )}
          <Button
            size="sm"
            variant="default"
            disabled={bulkSubmitting}
            onClick={() => void handleBulkCheckIn()}
            className="h-7 text-xs"
          >
            {bulkSubmitting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <PlayCircle className="h-3.5 w-3.5" />
            }
            Check in selected
          </Button>
        </div>
      )}
    </div>
  );
}
