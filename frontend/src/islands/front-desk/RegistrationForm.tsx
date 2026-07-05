import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { RegistrationDupResult, RegistrationFormData, RegistrationSaveResult } from '@core/types';
import { ConfirmModal } from '@components/ConfirmModal';
import { DeskAlert } from '@components/DeskAlert';
import { showDeskToast } from '@components/deskToast';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { RegistrationDupPanel } from './RegistrationDupPanel';
import { RegistrationFormSections, type RegistrationFormValues } from './RegistrationFormSections';
import { parseSearchQuery } from './registrationFormUtils';
import {
    collectRegistrationSection,
    DEFAULT_REGISTRATION_FORM,
    mapServerToRegistrationForm,
} from './registrationFormModel';
import { useRegistrationGeo } from './useRegistrationGeo';
import { useRegistrationDupCheck } from './useRegistrationDupCheck';
import {
    validateField,
    validateSection,
    hasValidationErrors,
    getValidationSummary,
    type ValidationErrors,
} from './registrationFormValidation';

export interface RegistrationFormHandle {
    isDirty: () => boolean;
}

interface RegistrationFormProps {
    ajaxUrl: string;
    csrfToken: string;
    pid?: number;
    prefill?: string;
    registrationMode?: string;
    wizardMode?: boolean;
    /** Patient chart profile tab — hides Save & Start and uses chart title. */
    chartMode?: boolean;
    /** Front Desk preview pane already renders the section title — omit duplicate heading. */
    hideTitle?: boolean;
    onSaved: (pid: number, startAfter?: boolean) => void;
    onUseExisting: (pid: number) => void;
    onCancel: () => void;
    /** Parent-owned discard modal (front desk). Falls back to inline ConfirmModal when omitted. */
    onDiscardConfirm?: (onProceed: () => void) => void;
    mergeToolBaseUrl?: string;
}

export const RegistrationForm = forwardRef<RegistrationFormHandle, RegistrationFormProps>(function RegistrationForm(
    {
        ajaxUrl,
        csrfToken,
        pid,
        prefill,
        registrationMode = 'desk_full_form',
        wizardMode = false,
        chartMode = false,
        hideTitle = false,
        onSaved,
        onUseExisting,
        onCancel,
        onDiscardConfirm,
        mergeToolBaseUrl,
    },
    ref
) {
    const [currentPid, setCurrentPid] = useState<number | null>(pid ?? null);
    const [activeSection, setActiveSection] = useState(1);
    const [form, setForm] = useState<RegistrationFormValues>(DEFAULT_REGISTRATION_FORM);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [completionScore, setCompletionScore] = useState<number | null>(null);
    const [completionMissing, setCompletionMissing] = useState<string[]>([]);
    const [dup, setDup] = useState<RegistrationDupResult>({ level: 'none', candidates: [] });
    const [dupConfirm, setDupConfirm] = useState(false);
    const [dupOverride, setDupOverride] = useState(false);
    const [dupOverrideReason, setDupOverrideReason] = useState('');
    const [discardOpen, setDiscardOpen] = useState(false);
    const [discardProceed, setDiscardProceed] = useState<(() => void) | null>(null);
    const [allergyNoneConfirmOpen, setAllergyNoneConfirmOpen] = useState(false);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [touchedFields, setTouchedFields] = useState<Set<keyof RegistrationFormValues>>(new Set());
    const prefillAppliedRef = useRef(false);

    useImperativeHandle(ref, () => ({
        isDirty: () => dirty,
    }), [dirty]);

    const requestDiscard = useCallback((onProceed: () => void) => {
        if (!dirty) {
            onProceed();
            return;
        }
        if (onDiscardConfirm) {
            onDiscardConfirm(onProceed);
            return;
        }
        setDiscardProceed(() => onProceed);
        setDiscardOpen(true);
    }, [dirty, onDiscardConfirm]);

    const handleFieldChange = (name: keyof RegistrationFormValues, value: string) => {
        setForm((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'insurance_type') {
                if (value !== 'nhis') {
                    next.nhis_number = '';
                    next.nhis_expiry = '';
                }
                if (value !== 'private') {
                    next.private_insurer = '';
                    next.private_policy = '';
                }
            }
            return next;
        });
        setDirty(true);
        setSuccess('');

        // Clear validation error for this field when user starts typing
        if (validationErrors[name]) {
            setValidationErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const handleFieldBlur = useCallback((name: keyof RegistrationFormValues) => {
        // Mark field as touched
        setTouchedFields((prev) => new Set(prev).add(name));

        // Validate field on blur
        const errorMessage = validateField(name, form[name], form);
        setValidationErrors((prev) => {
            const next = { ...prev };
            if (errorMessage) {
                next[name] = errorMessage;
            } else {
                delete next[name];
            }
            return next;
        });
    }, [form]);

    const handleCheckboxChange = (name: keyof RegistrationFormValues, checked: boolean) => {
        setForm((prev) => {
            const next = { ...prev, [name]: checked };
            if (name === 'no_phone' && checked) {
                next.phone = '';
            }
            if (name === 'allergies_none_known') {
                if (!checked && prev.allergies.trim() === '' && !prev.allergies_unknown) {
                    setAllergyNoneConfirmOpen(true);
                    return prev;
                }
                if (checked) {
                    next.allergies_unknown = false;
                    next.allergies = '';
                }
            }
            if (name === 'allergies_unknown' && checked) {
                next.allergies_none_known = false;
                next.allergies = '';
            }
            return next;
        });
        setDirty(true);
        setSuccess('');
    };

    const { regions, districts, loadingDistricts, handleRegionChange } = useRegistrationGeo(
        ajaxUrl,
        csrfToken,
        form.region_code,
        form.district_code,
        (code) => {
            setForm((prev) => ({ ...prev, region_code: code, district_code: '' }));
            setDirty(true);
            setSuccess('');
        }
    );

    const dupPayload = useMemo(() => ({
        fname: form.fname.trim(),
        lname: form.lname.trim(),
        sex: form.sex,
        DOB: form.DOB,
        age_years: form.age_years.trim(),
        phone: (form.no_phone ? form.reach_contact_phone : form.phone).trim(),
        no_phone: form.no_phone,
        reach_contact_name: form.reach_contact_name.trim(),
        reach_contact_phone: form.reach_contact_phone.trim(),
        national_id: form.national_id.trim(),
    }), [
        form.DOB,
        form.age_years,
        form.fname,
        form.lname,
        form.national_id,
        form.no_phone,
        form.phone,
        form.reach_contact_name,
        form.reach_contact_phone,
        form.sex,
    ]);

    const loadForm = useCallback(async (pidToLoad: number) => {
        setBusy(true);
        setError('');
        try {
            const data = await oeFetch<RegistrationFormData>('patients.registration.get', {
                ajaxUrl,
                csrfToken,
                method: 'POST',
                json: { pid: pidToLoad },
            });
            const nextForm = mapServerToRegistrationForm(data);
            setForm(nextForm);
            setCompletionScore(data.completion?.score ?? null);
            setCompletionMissing(data.completion?.missing ?? []);
            setCurrentPid(pidToLoad);
            setDirty(false);
            prefillAppliedRef.current = true;
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Could not load patient — network or server error.');
        } finally {
            setBusy(false);
        }
    }, [ajaxUrl, csrfToken]);

    useEffect(() => {
        setCurrentPid(pid ?? null);
        setForm(DEFAULT_REGISTRATION_FORM);
        setCompletionScore(null);
        setCompletionMissing([]);
        setError('');
        setSuccess('');
        setDup({ level: 'none', candidates: [] });
        setDupConfirm(false);
        setDupOverride(false);
        setDupOverrideReason('');
        setDirty(false);
        prefillAppliedRef.current = false;
        setActiveSection(1);

        if (pid) {
            void loadForm(pid);
        }
    }, [loadForm, pid]);

    useEffect(() => {
        setDupConfirm(false);
        setDupOverride(false);
        setDupOverrideReason('');
    }, [dup.level]);

    useEffect(() => {
        if (pid || prefillAppliedRef.current || !prefill) return;
        const parsed = parseSearchQuery(prefill);
        setForm((prev) => ({
            ...prev,
            fname: parsed.fname,
            lname: parsed.lname,
            phone: parsed.phone,
        }));
        prefillAppliedRef.current = true;
    }, [pid, prefill]);

    const handleDupResult = useCallback((result: RegistrationDupResult) => {
        setDup(result ?? { level: 'none', candidates: [] });
    }, []);

    useRegistrationDupCheck(ajaxUrl, csrfToken, currentPid, dupPayload, handleDupResult);

    const showError = (message: string) => {
        setError(message);
        setSuccess('');
    };

    const showSuccess = (message: string) => {
        setSuccess(message);
        setError('');
        showDeskToast(message, 'success');
    };

    const saveSection = async (section: number, startAfter: boolean) => {
        setError('');

        // Validate section before saving
        const sectionErrors = validateSection(section, form);
        if (hasValidationErrors(sectionErrors)) {
            setValidationErrors(sectionErrors);
            const summary = getValidationSummary(sectionErrors);
            showError(`Cannot save: ${summary}. Please fix the errors and try again.`);
            return;
        }

        const patient = collectRegistrationSection(form, section);

        if (section === 1 && form.no_phone) {
            if (!form.reach_contact_name.trim() || !form.reach_contact_phone.trim() || !form.reach_contact_relationship.trim()) {
                showError('Reach contact name, phone, and relationship are required when patient has no personal phone.');
                return;
            }
        }
        if (section === 3 && form.allergies_none_known && form.allergies_unknown) {
            showError('Choose either no known allergies or allergies unknown, not both.');
            return;
        }
        if (!currentPid && section !== 1) {
            showError('Save Section 1 first to create the patient.');
            return;
        }
        if (!currentPid && dup.level === 'block' && !dupOverride) {
            showError('Likely duplicate — use existing patient or override with reason.');
            return;
        }
        if (!currentPid && dup.level === 'warn' && !dupConfirm) {
            showError('Confirm this is a different patient before saving.');
            return;
        }

        const action = currentPid ? 'patients.update' : 'patients.create';
        setBusy(true);
        try {
            const result = await oeFetch<RegistrationSaveResult>(action, {
                ajaxUrl,
                csrfToken,
                method: 'POST',
                json: {
                    ...(currentPid ? { pid: currentPid } : {}),
                    section,
                    patient,
                    national_id: form.national_id.trim(),
                    no_phone: form.no_phone,
                    dup_confirm: dupConfirm,
                    dup_override: dupOverride,
                    dup_override_reason: dupOverrideReason.trim(),
                },
            });

            const savedPid = result.pid;
            setCurrentPid(savedPid);
            setCompletionScore(result.completion_score ?? completionScore);
            setCompletionMissing(result.completion_missing ?? completionMissing);
            setDirty(false);
            setValidationErrors({});
            setTouchedFields(new Set());
            showSuccess(`Section ${section} saved.`);
            await loadForm(savedPid);

            if (startAfter) {
                onSaved(savedPid, true);
            }
        } catch (saveError) {
            showError(saveError instanceof Error ? saveError.message : 'Save failed — network or server error.');
        } finally {
            setBusy(false);
        }
    };

    const formTitle = chartMode ? 'Patient profile' : currentPid ? 'Edit profile' : 'Register patient';

    return (
        <Card className="nc-registration-form border-0 bg-transparent shadow-none" id="nc-registration-form">
            <CardHeader className={cn('mb-2 border-0 px-0 py-0', hideTitle ? 'justify-end' : 'gap-3')}>
                {!hideTitle && <CardTitle className="text-lg">{formTitle}</CardTitle>}
                <Badge variant="neutral" id="nc-reg-completion">
                    {completionScore == null ? '—' : `${completionScore}% complete`}
                </Badge>
            </CardHeader>

            <CardContent className="space-y-0 p-0">
            <div id="nc-dup-panel">
                <RegistrationDupPanel
                    dup={dup}
                    dupConfirm={dupConfirm}
                    dupOverride={dupOverride}
                    dupOverrideReason={dupOverrideReason}
                    onDupConfirmChange={setDupConfirm}
                    onDupOverrideChange={setDupOverride}
                    onDupOverrideReasonChange={setDupOverrideReason}
                    onUseExisting={onUseExisting}
                    mergeToolBaseUrl={mergeToolBaseUrl}
                />
            </div>

            <RegistrationFormSections
                form={form}
                activeSection={activeSection}
                missingKeys={completionMissing}
                regions={regions}
                districts={districts}
                loadingDistricts={loadingDistricts}
                wizardMode={wizardMode}
                validationErrors={validationErrors}
                onSectionToggle={setActiveSection}
                onSaveSection={(section) => {
                    setActiveSection(section);
                    void saveSection(section, false);
                }}
                onFieldChange={handleFieldChange}
                onCheckboxChange={handleCheckboxChange}
                onRegionChange={handleRegionChange}
                onFieldBlur={handleFieldBlur}
            />

            {error && (
                <DeskAlert tone="error" className="mt-3 flex items-start gap-3" id="nc-reg-error" role="alert">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" aria-hidden />
                    <span className="text-sm">{error}</span>
                </DeskAlert>
            )}
            {success && (
                <DeskAlert tone="success" className="mt-3 flex items-start gap-3" id="nc-reg-success" role="status">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                    <span className="text-sm font-medium">{success}</span>
                </DeskAlert>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
                <Button
                    type="button"
                    id="nc-reg-save"
                    disabled={busy}
                    onClick={() => {
                        void saveSection(activeSection, false);
                    }}
                >
                    Save
                </Button>
                {registrationMode === 'desk_full_form' && !chartMode && (
                    <Button
                        type="button"
                        variant="cta"
                        id="nc-reg-save-start"
                        disabled={busy}
                        onClick={() => {
                            void saveSection(1, true);
                        }}
                    >
                        Save &amp; Start visit
                    </Button>
                )}
                <Button
                    type="button"
                    variant="outline"
                    id="nc-reg-cancel"
                    disabled={busy}
                    onClick={() => {
                        requestDiscard(() => {
                            setDirty(false);
                            onCancel();
                        });
                    }}
                >
                    Cancel
                </Button>
            </div>
            </CardContent>

            <ConfirmModal
                open={discardOpen}
                onClose={() => {
                    setDiscardOpen(false);
                    setDiscardProceed(null);
                }}
                title="Discard changes?"
                modalId="nc-reg-discard-modal"
                cancelLabel="Keep editing"
                confirmLabel="Discard"
                confirmVariant="warning"
                onConfirm={() => {
                    discardProceed?.();
                    setDiscardOpen(false);
                    setDiscardProceed(null);
                }}
            >
                <p className="mb-0">Discard unsaved registration changes?</p>
            </ConfirmModal>

            <ConfirmModal
                open={allergyNoneConfirmOpen}
                onClose={() => setAllergyNoneConfirmOpen(false)}
                title="No allergies documented?"
                modalId="nc-reg-allergy-none-modal"
                cancelLabel="Go back"
                confirmLabel="Continue"
                confirmVariant="warning"
                onConfirm={() => {
                    setForm((prev) => ({ ...prev, allergies_none_known: false }));
                    setDirty(true);
                    setSuccess('');
                    setAllergyNoneConfirmOpen(false);
                }}
            >
                <p className="mb-0">No allergies listed. Continue without documenting allergies?</p>
            </ConfirmModal>
        </Card>
    );
});
