import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { RegistrationDupResult } from '@core/types';
import { RegistrationDupPanel } from './RegistrationDupPanel';
import type { RegistrationFormHandle } from './RegistrationForm';
import { parseSearchQuery } from './registrationFormUtils';

interface QuickAddRegistrationProps {
    ajaxUrl: string;
    csrfToken: string;
    prefill?: string;
    onSaved: (pid: number, startAfter?: boolean) => void;
    onUseExisting: (pid: number) => void;
    onCancel: () => void;
}

function shouldRunDupCheck(payload: {
    fname: string;
    lname: string;
    phone: string;
}): boolean {
    return payload.fname.length >= 2
        || payload.lname.length >= 2
        || payload.phone.length >= 2;
}

export const QuickAddRegistration = forwardRef<RegistrationFormHandle, QuickAddRegistrationProps>(
    function QuickAddRegistration(
        { ajaxUrl, csrfToken, prefill, onSaved, onUseExisting, onCancel },
        ref,
    ) {
        const parsedPrefill = useMemo(() => parseSearchQuery(prefill ?? ''), [prefill]);
        const [fname, setFname] = useState(parsedPrefill.fname);
        const [lname, setLname] = useState(parsedPrefill.lname);
        const [sex, setSex] = useState('');
        const [dob, setDob] = useState('');
        const [ageYears, setAgeYears] = useState('');
        const [phone, setPhone] = useState(parsedPrefill.phone);
        const [noPhoneReason, setNoPhoneReason] = useState('');
        const [dirty, setDirty] = useState(false);
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState('');
        const [dup, setDup] = useState<RegistrationDupResult>({ level: 'none', candidates: [] });
        const [dupConfirm, setDupConfirm] = useState(false);
        const [dupOverride, setDupOverride] = useState(false);
        const [dupOverrideReason, setDupOverrideReason] = useState('');

        useImperativeHandle(ref, () => ({
            confirmDiscard: () => (!dirty ? true : window.confirm('Discard registration changes and switch patient?')),
            isDirty: () => dirty,
        }), [dirty]);

        const dupPayload = useMemo(() => ({
            fname: fname.trim(),
            lname: lname.trim(),
            sex,
            DOB: dob,
            age_years: ageYears.trim() === '' ? null : Number.parseInt(ageYears, 10),
            phone: phone.trim(),
            no_phone_reason: noPhoneReason.trim(),
        }), [ageYears, dob, fname, lname, noPhoneReason, phone, sex]);

        useEffect(() => {
            setFname(parsedPrefill.fname);
            setLname(parsedPrefill.lname);
            setPhone(parsedPrefill.phone);
            setSex('');
            setDob('');
            setAgeYears('');
            setNoPhoneReason('');
            setDirty(false);
            setError('');
            setDup({ level: 'none', candidates: [] });
            setDupConfirm(false);
            setDupOverride(false);
            setDupOverrideReason('');
        }, [parsedPrefill.fname, parsedPrefill.lname, parsedPrefill.phone, prefill]);

        useEffect(() => {
            setDupConfirm(false);
            setDupOverride(false);
            setDupOverrideReason('');
        }, [dup.level]);

        useEffect(() => {
            if (!shouldRunDupCheck({
                fname: dupPayload.fname,
                lname: dupPayload.lname,
                phone: dupPayload.phone,
            })) {
                setDup({ level: 'none', candidates: [] });
                return undefined;
            }

            const timer = window.setTimeout(async () => {
                try {
                    const result = await oeFetch<RegistrationDupResult>('patients.dup_check', {
                        ajaxUrl,
                        csrfToken,
                        method: 'POST',
                        json: dupPayload,
                    });
                    setDup(result ?? { level: 'none', candidates: [] });
                } catch {
                    setDup({ level: 'none', candidates: [] });
                }
            }, 300);
            return () => window.clearTimeout(timer);
        }, [ajaxUrl, csrfToken, dupPayload]);

        const savePatient = async (startAfter: boolean) => {
            setError('');
            if (dup.level === 'block' && !dupOverride) {
                setError('Likely duplicate — use existing patient or override with reason.');
                return;
            }
            if (dup.level === 'warn' && !dupConfirm) {
                setError('Confirm this is a different patient before saving.');
                return;
            }

            setBusy(true);
            try {
                const result = await oeFetch<{ pid: number }>('patients.create', {
                    ajaxUrl,
                    csrfToken,
                    method: 'POST',
                    json: {
                        ...dupPayload,
                        dup_confirm: dupConfirm,
                        dup_override: dupOverride,
                        dup_override_reason: dupOverrideReason.trim(),
                    },
                });
                setDirty(false);
                onSaved(result.pid, startAfter);
            } catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : 'Save failed — network or server error.');
            } finally {
                setBusy(false);
            }
        };

        const markDirty = () => {
            setDirty(true);
            setError('');
        };

        return (
            <div className="nc-quick-add" id="nc-quick-add-form">
                <h4>Quick Add patient</h4>
                <p className="text-muted small">Level 1 identity — save then start visit.</p>

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

                <div className="form-row">
                    <div className="form-group col-md-6">
                        <label htmlFor="nc-qa-fname">First name</label>
                        <input
                            className="form-control"
                            id="nc-qa-fname"
                            value={fname}
                            onChange={(e) => { setFname(e.target.value); markDirty(); }}
                        />
                    </div>
                    <div className="form-group col-md-6">
                        <label htmlFor="nc-qa-lname">Last name</label>
                        <input
                            className="form-control"
                            id="nc-qa-lname"
                            value={lname}
                            onChange={(e) => { setLname(e.target.value); markDirty(); }}
                        />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-qa-sex">Sex</label>
                        <select
                            className="form-control"
                            id="nc-qa-sex"
                            value={sex}
                            onChange={(e) => { setSex(e.target.value); markDirty(); }}
                        >
                            <option value="">Select</option>
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="UNK">Other / Unknown</option>
                        </select>
                    </div>
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-qa-dob">Date of birth</label>
                        <input
                            type="date"
                            className="form-control"
                            id="nc-qa-dob"
                            value={dob}
                            onChange={(e) => { setDob(e.target.value); markDirty(); }}
                        />
                    </div>
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-qa-age">Or age (years)</label>
                        <input
                            type="number"
                            min={0}
                            max={130}
                            className="form-control"
                            id="nc-qa-age"
                            value={ageYears}
                            onChange={(e) => { setAgeYears(e.target.value); markDirty(); }}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="nc-qa-phone">Phone</label>
                    <input
                        className="form-control"
                        id="nc-qa-phone"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); markDirty(); }}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="nc-qa-no-phone-reason">No-phone reason (if blank phone)</label>
                    <input
                        className="form-control"
                        id="nc-qa-no-phone-reason"
                        placeholder="child, elder, relative-contact"
                        value={noPhoneReason}
                        onChange={(e) => { setNoPhoneReason(e.target.value); markDirty(); }}
                    />
                </div>

                {error && (
                    <div className="alert alert-danger" id="nc-qa-error">
                        {error}
                    </div>
                )}

                <div className="d-flex flex-wrap gap-2">
                    <button
                        type="button"
                        className="oe-nc-btn-primary-lg mr-2 mb-2"
                        id="nc-qa-save"
                        disabled={busy}
                        onClick={() => void savePatient(false)}
                    >
                        <i className="fa fa-save" aria-hidden="true" />
                        <span>Save</span>
                    </button>
                    <button
                        type="button"
                        className="oe-nc-btn-primary-lg mr-2 mb-2"
                        id="nc-qa-save-start"
                        disabled={busy}
                        onClick={() => void savePatient(true)}
                    >
                        <i className="fa fa-play" aria-hidden="true" />
                        <span>Save and Start visit</span>
                    </button>
                    <button
                        type="button"
                        className="btn btn-outline-secondary mb-2"
                        id="nc-qa-cancel"
                        disabled={busy}
                        onClick={() => {
                            if (dirty && !window.confirm('Discard unsaved registration changes?')) {
                                return;
                            }
                            setDirty(false);
                            onCancel();
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    },
);
