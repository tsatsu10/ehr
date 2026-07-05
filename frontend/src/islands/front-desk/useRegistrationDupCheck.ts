import { useEffect } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { RegistrationDupResult } from '@core/types';
import type { RegistrationDupPayload } from './registrationFormModel';
import { shouldRunRegistrationDupCheck } from './registrationFormModel';

export function useRegistrationDupCheck(
    ajaxUrl: string,
    csrfToken: string,
    currentPid: number | null,
    payload: RegistrationDupPayload,
    onResult: (result: RegistrationDupResult) => void,
): void {
    useEffect(() => {
        if (!shouldRunRegistrationDupCheck(payload)) {
            onResult({ level: 'none', candidates: [] });
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
                onResult(result ?? { level: 'none', candidates: [] });
            } catch {
                onResult({ level: 'none', candidates: [] });
            }
        }, 300);

        return () => window.clearTimeout(timer);
    }, [ajaxUrl, csrfToken, currentPid, onResult, payload]);
}
