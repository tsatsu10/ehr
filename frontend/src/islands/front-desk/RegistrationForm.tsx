import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { RegistrationDupResult, RegistrationFormData, RegistrationSaveResult } from '@core/types';
import { ConfirmModal } from '@components/ConfirmModal';
import { RegistrationDupPanel } from './RegistrationDupPanel';
import { RegistrationFormSections, type RegistrationFormValues } from './RegistrationFormSections';
import { parseSearchQuery, tagsToString } from './registrationFormUtils';
import { useRegistrationGeo } from './useRegistrationGeo';

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
    onSaved: (pid: number, startAfter?: boolean) => void;
    onUseExisting: (pid: number) => void;
    onCancel: () => void;
    /** Parent-owned discard modal (front desk). Falls back to inline ConfirmModal when omitted. */
    onDiscardConfirm?: (onProceed: () => void) => void;
}

const DEFAULT_FORM: RegistrationFormValues = {
    fname: '',
    lname: '',
    mname: '',
    sex: '',
    DOB: '',
    age_years: '',
    phone: '',
    no_phone: false,
    reach_contact_name: '',
    reach_contact_phone: '',
    reach_contact_relationship: '',
    national_id: '',
    street: '',
    landmark: '',
    nationality: '',
    region_code: '',
    district_code: '',
    place_of_birth: '',
    tribe: '',
    phone_home: '',
    email: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    blood_group: '',
    allergies_none_known: false,
    allergies_unknown: false,
    allergies: '',
    chronic_conditions: '',
    pregnancy_status: '',
    disability_flag: false,
    religion: '',
    race: '',
    education_level: '',
    occupation: '',
    insurance_type: 'cash',
    nhis_number: '',
    nhis_expiry: '',
    private_insurer: '',
    private_policy: '',
    insurance_label: '',
};

function mapServerToForm(data: RegistrationFormData): RegistrationFormValues {
    const section1 = data.section_1 ?? {};
    const section2 = data.section_2 ?? {};
    const section3 = data.section_3 ?? {};
    const section4 = data.section_4 ?? {};

    return {
        ...DEFAULT_FORM,
        fname: String(section1.fname ?? ''),
        lname: String(section1.lname ?? ''),
        mname: String(section1.mname ?? ''),
        sex: String(section1.sex ?? ''),
        DOB: section1.DOB && section1.DOB !== '0000-00-00' ? String(section1.DOB) : '',
        age_years: section1.age_years == null ? '' : String(section1.age_years),
        phone: String(section1.phone ?? ''),
        no_phone: !!section1.no_phone,
        reach_contact_name: String(section1.reach_contact_name ?? ''),
        reach_contact_phone: String(section1.reach_contact_phone ?? ''),
        reach_contact_relationship: String(section1.reach_contact_relationship ?? ''),
        national_id: String(section1.national_id ?? section2.national_id ?? ''),
        street: String(section2.street ?? ''),
        landmark: String(section2.landmark ?? ''),
        nationality: String(section2.nationality ?? ''),
        region_code: String(section2.region_code ?? ''),
        district_code: String(section2.district_code ?? ''),
        place_of_birth: String(section2.place_of_birth ?? ''),
        tribe: String(section2.tribe ?? ''),
        phone_home: String(section2.phone_home ?? ''),
        email: String(section2.email ?? ''),
        emergency_contact_name: String(section2.emergency_contact_name ?? ''),
        emergency_contact_phone: String(section2.emergency_contact_phone ?? ''),
        blood_group: String(section3.blood_group ?? ''),
        allergies_none_known: !!section3.allergies_none_known,
        allergies_unknown: !!section3.allergies_unknown,
        allergies: tagsToString(Array.isArray(section3.allergies) ? section3.allergies : []),
        chronic_conditions: tagsToString(Array.isArray(section3.chronic_conditions) ? section3.chronic_conditions : []),
        pregnancy_status: String(section3.pregnancy_status ?? ''),
        disability_flag: !!section3.disability_flag,
        religion: String(section3.religion ?? ''),
        race: String(section3.race ?? ''),
        education_level: String(section3.education_level ?? ''),
        occupation: String(section3.occupation ?? ''),
        insurance_type: String(section4.insurance_type ?? 'cash'),
        nhis_number: String(section4.nhis_number ?? ''),
        nhis_expiry: String(section4.nhis_expiry ?? ''),
        private_insurer: String(section4.private_insurer ?? ''),
        private_policy: String(section4.private_policy ?? ''),
        insurance_label: String(section4.insurance_label ?? ''),
    };
}

function shouldRunDupCheck(payload: {
    fname: string;
    lname: string;
    phone: string;
    reach_contact_phone: string;
    national_id: string;
}): boolean {
    return payload.fname.length >= 2
        || payload.lname.length >= 2
        || payload.phone.length >= 2
        || payload.reach_contact_phone.length >= 2
        || payload.national_id.length >= 2;
}

function collectSection(form: RegistrationFormValues, section: number): Record<string, unknown> {
    if (section === 1) {
        return {
            fname: form.fname.trim(),
            lname: form.lname.trim(),
            mname: form.mname.trim(),
            sex: form.sex,
            phone: form.phone.trim(),
            no_phone: form.no_phone,
            reach_contact_name: form.reach_contact_name.trim(),
            reach_contact_phone: form.reach_contact_phone.trim(),
            reach_contact_relationship: form.reach_contact_relationship.trim(),
            DOB: form.DOB,
            age_years: form.age_years.trim() === '' ? null : Number.parseInt(form.age_years, 10),
            national_id: form.national_id.trim(),
        };
    }
    if (section === 2) {
        return {
            street: form.street.trim(),
            landmark: form.landmark.trim(),
            nationality: form.nationality.trim(),
            region_code: form.region_code,
            district_code: form.district_code,
            place_of_birth: form.place_of_birth.trim(),
            tribe: form.tribe.trim(),
            national_id: form.national_id.trim(),
            phone_home: form.phone_home.trim(),
            email: form.email.trim(),
            emergency_contact_name: form.emergency_contact_name.trim(),
            emergency_contact_phone: form.emergency_contact_phone.trim(),
        };
    }
    if (section === 3) {
        return {
            blood_group: form.blood_group,
            allergies_none_known: form.allergies_none_known,
            allergies_unknown: form.allergies_unknown,
            allergies: form.allergies.trim(),
            chronic_conditions: form.chronic_conditions.trim(),
            pregnancy_status: form.pregnancy_status,
            disability_flag: form.disability_flag,
            religion: form.religion.trim(),
            race: form.race.trim(),
            education_level: form.education_level.trim(),
            occupation: form.occupation.trim(),
        };
    }
    return {
        insurance_type: form.insurance_type,
        nhis_number: form.nhis_number.trim(),
        nhis_expiry: form.nhis_expiry,
        private_insurer: form.private_insurer.trim(),
        private_policy: form.private_policy.trim(),
    };
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
        onSaved,
        onUseExisting,
        onCancel,
        onDiscardConfirm,
    },
    ref
) {
    const [currentPid, setCurrentPid] = useState<number | null>(pid ?? null);
    const [activeSection, setActiveSection] = useState(1);
    const [form, setForm] = useState<RegistrationFormValues>(DEFAULT_FORM);
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
    };

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
            const nextForm = mapServerToForm(data);
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
        setForm(DEFAULT_FORM);
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

    useEffect(() => {
        if (!shouldRunDupCheck(dupPayload)) {
            setDup({ level: 'none', candidates: [] });
            return undefined;
        }

        const timer = window.setTimeout(async () => {
            try {
                const result = await oeFetch<RegistrationDupResult>('patients.dup_check', {
                    ajaxUrl,
                    csrfToken,
                    method: 'POST',
                    json: {
                        ...dupPayload,
                        exclude_pid: currentPid ?? 0,
                    },
                });
                setDup(result ?? { level: 'none', candidates: [] });
            } catch {
                setDup({ level: 'none', candidates: [] });
            }
        }, 300);
        return () => window.clearTimeout(timer);
    }, [ajaxUrl, csrfToken, currentPid, dupPayload]);

    const showError = (message: string) => {
        setError(message);
        setSuccess('');
    };

    const showSuccess = (message: string) => {
        setSuccess(message);
        setError('');
    };

    const saveSection = async (section: number, startAfter: boolean) => {
        setError('');
        const patient = collectSection(form, section);

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

    return (
        <div className="nc-registration-form" id="nc-registration-form">
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="mb-0">
                    {chartMode ? 'Patient profile' : currentPid ? 'Edit profile' : 'Register patient'}
                </h4>
                <span className="badge badge-secondary" id="nc-reg-completion">
                    {completionScore == null ? '—' : `${completionScore}% complete`}
                </span>
            </div>

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
                onSectionToggle={setActiveSection}
                onSaveSection={(section) => {
                    setActiveSection(section);
                    void saveSection(section, false);
                }}
                onFieldChange={handleFieldChange}
                onCheckboxChange={handleCheckboxChange}
                onRegionChange={handleRegionChange}
            />

            {error && (
                <div className="alert alert-danger mt-2" id="nc-reg-error">
                    {error}
                </div>
            )}
            {success && (
                <div className="alert alert-success mt-2" id="nc-reg-success">
                    {success}
                </div>
            )}

            <div className="d-flex flex-wrap mt-3">
                <button
                    type="button"
                    className="btn btn-primary mr-2 mb-2"
                    id="nc-reg-save"
                    disabled={busy}
                    onClick={() => {
                        void saveSection(activeSection, false);
                    }}
                >
                    Save
                </button>
                {registrationMode === 'desk_full_form' && !chartMode && (
                    <button
                        type="button"
                        className="btn btn-success mr-2 mb-2"
                        id="nc-reg-save-start"
                        disabled={busy}
                        onClick={() => {
                            void saveSection(1, true);
                        }}
                    >
                        Save &amp; Start visit
                    </button>
                )}
                <button
                    type="button"
                    className="btn btn-outline-secondary mb-2"
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
                </button>
            </div>

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
        </div>
    );
});
