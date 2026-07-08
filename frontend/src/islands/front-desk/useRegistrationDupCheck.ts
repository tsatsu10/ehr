import { useEffect, useState, useCallback } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { RegistrationDupResult } from '@core/types';
import type { RegistrationDupPayload } from './registrationFormModel';
import { shouldRunRegistrationDupCheck } from './registrationFormModel';
import { findFuzzyDuplicates, type DuplicateCandidate } from './fuzzyDuplicateDetection';

export function useRegistrationDupCheck(
    ajaxUrl: string,
    csrfToken: string,
    currentPid: number | null,
    payload: RegistrationDupPayload,
    onResult: (result: RegistrationDupResult) => void,
    /** Optional: local patient list for fuzzy matching */
    localPatients?: Array<{
        pid: number;
        display_name: string;
        pubpid: string;
        dob?: string;
        phone_masked?: string;
    }>,
): void {
    const [serverResult, setServerResult] = useState<RegistrationDupResult | null>(null);
    const [fuzzyMatches, setFuzzyMatches] = useState<DuplicateCandidate[]>([]);

    // Run fuzzy matching locally if we have patient data
    useEffect(() => {
        if (!localPatients || localPatients.length === 0) {
            setFuzzyMatches([]);
            return;
        }

        if (!shouldRunRegistrationDupCheck(payload)) {
            setFuzzyMatches([]);
            return;
        }

        const timer = window.setTimeout(() => {
            const matches = findFuzzyDuplicates(
                {
                    name: `${payload.fname} ${payload.lname}`.trim(),
                    dob: payload.DOB,
                    phone: payload.phone,
                    threshold: 60, // Medium confidence minimum
                },
                localPatients.filter((p) => p.pid !== currentPid)
            );
            setFuzzyMatches(matches);
        }, 300);

        return () => window.clearTimeout(timer);
    }, [localPatients, currentPid, payload]);

    // Run server-side duplicate check
    useEffect(() => {
        if (!shouldRunRegistrationDupCheck(payload)) {
            setServerResult({ level: 'none', candidates: [] });
            return undefined;
        }

        const timer = window.setTimeout(async () => {
            try {
                const result = await oeFetch<RegistrationDupResult>('patients.dup_check', {
                    ajaxUrl,
                    csrfToken,
                    method: 'POST',
                    json: {
                        ...payload,
                        exclude_pid: currentPid ?? 0,
                    },
                });
                setServerResult(result ?? { level: 'none', candidates: [] });
            } catch {
                setServerResult({ level: 'none', candidates: [] });
            }
        }, 300);

        return () => window.clearTimeout(timer);
    }, [ajaxUrl, csrfToken, currentPid, payload]);

    // Merge server and fuzzy results
    const mergeResults = useCallback(() => {
        if (!serverResult) return null;

        // If server found high-confidence matches, use those
        if (serverResult.level === 'block') {
            return serverResult;
        }

        // Otherwise, enhance with fuzzy matches
        if (fuzzyMatches.length === 0) {
            return serverResult;
        }

        // Combine server candidates with fuzzy matches
        const serverPids = new Set(serverResult.candidates?.map((c) => c.pid) ?? []);
        const allCandidates = [
            ...(serverResult.candidates ?? []),
            ...fuzzyMatches
                .filter((fm) => !serverPids.has(fm.pid))
                .map((fm) => ({
                    pid: fm.pid,
                    display_name: fm.displayName,
                    pubpid: fm.pubpid,
                    score: fm.confidenceScore,
                    match_reasons: fm.matchReasons,
                })),
        ].sort((a, b) => b.score - a.score);

        // Determine level based on highest score
        const maxScore = allCandidates[0]?.score ?? 0;
        let level: RegistrationDupResult['level'] = 'none';
        if (maxScore >= 90) {
            level = 'block';
        } else if (maxScore >= 60) {
            level = 'warn';
        }

        return {
            level,
            candidates: allCandidates,
        };
    }, [serverResult, fuzzyMatches]);

    useEffect(() => {
        const merged = mergeResults();
        if (merged) {
            onResult(merged);
        }
    }, [mergeResults, onResult]);
}
