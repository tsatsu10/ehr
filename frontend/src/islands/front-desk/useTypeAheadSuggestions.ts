/**
 * useTypeAheadSuggestions — provides instant search suggestions from cached data
 * while the main search is loading
 */

import { useMemo } from 'react';
import type { PatientSearchRow, TodaysAppointmentRow } from '@core/types';
import type { RecentPatient } from '@core/useRecentlyViewedPatients';

export interface TypeAheadSuggestion {
  pid: number;
  displayName: string;
  pubpid: string;
  source: 'recent' | 'appointment' | 'search';
  match: string; // What part matched the query
  score: number; // Relevance score for sorting
}

/**
 * Hook for generating instant type-ahead suggestions from cached data
 * 
 * @example
 * const suggestions = useTypeAheadSuggestions({
 *   query: 'john',
 *   recentPatients,
 *   todaysAppointments,
 *   previousResults,
 * });
 * 
 * // Returns instant matches from recent/appointments/cache
 * // Sorted by relevance score
 */
export function useTypeAheadSuggestions({
  query,
  recentPatients = [],
  todaysAppointments = [],
  previousResults = [],
  maxSuggestions = 5,
}: {
  query: string;
  recentPatients?: RecentPatient[];
  todaysAppointments?: TodaysAppointmentRow[];
  previousResults?: PatientSearchRow[];
  maxSuggestions?: number;
}): TypeAheadSuggestion[] {
  return useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Don't show suggestions for very short queries
    if (trimmedQuery.length === 0) return [];
    
    const suggestions: TypeAheadSuggestion[] = [];
    const seenPids = new Set<number>();

    // Helper to calculate match score (higher = better match)
    function calculateScore(text: string, field: 'name' | 'id'): number {
      const lower = text.toLowerCase();
      
      // Exact match
      if (lower === trimmedQuery) return field === 'name' ? 100 : 90;
      
      // Starts with query (prefix match)
      if (lower.startsWith(trimmedQuery)) return field === 'name' ? 80 : 70;
      
      // Contains query (substring match)
      if (lower.includes(trimmedQuery)) return field === 'name' ? 60 : 50;
      
      // Fuzzy word match (any word starts with query)
      const words = lower.split(/\s+/);
      if (words.some(word => word.startsWith(trimmedQuery))) return field === 'name' ? 70 : 60;
      
      return 0;
    }

    // Helper to add suggestion if matches
    function tryAddSuggestion(
      pid: number,
      displayName: string,
      pubpid: string,
      source: TypeAheadSuggestion['source'],
      phone?: string
    ) {
      if (seenPids.has(pid)) return;

      let score = 0;
      let match = '';

      // Check name match
      const nameScore = calculateScore(displayName, 'name');
      if (nameScore > 0) {
        score = nameScore;
        match = displayName;
      }

      // Check ID match (higher priority than name for exact matches)
      if (pubpid) {
        const idScore = calculateScore(pubpid, 'id');
        if (idScore > score) {
          score = idScore;
          match = `MRN ${pubpid}`;
        }
      }

      // Check phone match
      if (phone) {
        const phoneDigits = phone.replace(/\D/g, '');
        const queryDigits = trimmedQuery.replace(/\D/g, '');
        if (queryDigits && phoneDigits.includes(queryDigits)) {
          const phoneScore = 65;
          if (phoneScore > score) {
            score = phoneScore;
            match = `Phone ${phone}`;
          }
        }
      }

      if (score > 0) {
        suggestions.push({ pid, displayName, pubpid, source, match, score });
        seenPids.add(pid);
      }
    }

    // 1. Check recent patients first (highest priority for recency)
    for (const recent of recentPatients) {
      tryAddSuggestion(recent.pid, recent.display_name, recent.pubpid, 'recent');
    }

    // 2. Check today's appointments (high priority for relevance)
    for (const appt of todaysAppointments) {
      tryAddSuggestion(
        appt.pid,
        appt.patient_name,
        appt.pubpid || '',
        'appointment',
        appt.phone_formatted
      );
    }

    // 3. Check previous search results (cache)
    for (const result of previousResults) {
      tryAddSuggestion(
        result.pid,
        result.display_name,
        result.pubpid || '',
        'search',
        result.phone_formatted
      );
    }

    // Sort by score (descending) and limit
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);
  }, [query, recentPatients, todaysAppointments, previousResults, maxSuggestions]);
}
