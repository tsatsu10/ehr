import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { RegistrationDupResult } from '@core/types';
import { ConfirmModal } from '@components/ConfirmModal';
import { showDeskToast } from '@components/deskToast';
import { DeskAlert } from '@components/DeskAlert';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { RegistrationDupPanel } from './RegistrationDupPanel';
import type { RegistrationFormHandle } from './RegistrationForm';
import { parseSearchQuery } from './registrationFormUtils';
import { Play, Save } from 'lucide-react';

interface QuickAddRegistrationProps {
    ajaxUrl: string;
    csrfToken: string;
    prefill?: string;
    onSaved: (pid: number, startAfter?: boolean) => void;
    onUseExisting: (pid: number) => void;
    onCancel: () => void;
    onDiscardConfirm?: (onProceed: () => void) => void;
    /** Front Desk preview pane already renders the section title — omit duplicate heading. */
    hideTitle?: boolean;
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
        { ajaxUrl, csrfToken, prefill, onSaved, onUseExisting, onCancel, onDiscardConfirm, hideTitle = false },
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
        const [discardOpen, setDiscardOpen] = useState(false);
        const [discardProceed, setDiscardProceed] = useState<(() => void) | null>(null);

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
                showDeskToast(
                    startAfter ? 'Patient saved — starting visit.' : 'Patient saved.',
                    'success',
                );
                onSaved(result.pid, startAfter);
            } catch (saveError) {
                const message = saveError instanceof Error
                    ? saveError.message
                    : 'Save failed — network or server error.';
                setError(message);
                showDeskToast(message, 'danger');
            } finally {
                setBusy(false);
            }
        };

        const markDirty = () => {
            setDirty(true);
            setError('');
        };

        return (
            <Card className="nc-quick-add border-0 bg-transparent shadow-none" id="nc-quick-add-form">
                {!hideTitle && (
                    <CardHeader className="mb-3 flex-col items-start gap-1 border-0 px-0 py-0">
                        <CardTitle className="text-lg">Quick Add patient</CardTitle>
                        <CardDescription className="m-0">
                            Level 1 identity — save then start visit.
                        </CardDescription>
                    </CardHeader>
                )}

                <CardContent className="p-0">
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label htmlFor="nc-qa-fname">First name</Label>
                        <Input
                            id="nc-qa-fname"
                            value={fname}
                            onChange={(e) => { setFname(e.target.value); markDirty(); }}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="nc-qa-lname">Last name</Label>
                        <Input
                            id="nc-qa-lname"
                            value={lname}
                            onChange={(e) => { setLname(e.target.value); markDirty(); }}
                        />
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                        <Label htmlFor="nc-qa-sex">Sex</Label>
                        <Select value={sex || undefined} onValueChange={(value) => { setSex(value); markDirty(); }}>
                            <SelectTrigger id="nc-qa-sex">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="UNK">Other / Unknown</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="nc-qa-dob">Date of birth</Label>
                        <Input
                            type="date"
                            id="nc-qa-dob"
                            value={dob}
                            onChange={(e) => { setDob(e.target.value); markDirty(); }}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="nc-qa-age">Or age (years)</Label>
                        <Input
                            type="number"
                            min={0}
                            max={130}
                            id="nc-qa-age"
                            value={ageYears}
                            onChange={(e) => { setAgeYears(e.target.value); markDirty(); }}
                        />
                    </div>
                </div>
                <div className="mt-3 space-y-1">
                    <Label htmlFor="nc-qa-phone">Phone</Label>
                    <Input
                        id="nc-qa-phone"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); markDirty(); }}
                    />
                </div>
                <div className="mt-3 space-y-1">
                    <Label htmlFor="nc-qa-no-phone-reason">No-phone reason (if blank phone)</Label>
                    <Input
                        id="nc-qa-no-phone-reason"
                        placeholder="child, elder, relative-contact"
                        value={noPhoneReason}
                        onChange={(e) => { setNoPhoneReason(e.target.value); markDirty(); }}
                    />
                </div>

                {error && (
                    <DeskAlert tone="error" className="mt-3 flex items-start gap-3 text-sm" id="nc-qa-error" role="alert">
                        {error}
                    </DeskAlert>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                        type="button"
                        id="nc-qa-save"
                        disabled={busy}
                        onClick={() => void savePatient(false)}
                    >
                        <Save className="h-4 w-4" aria-hidden="true" />
                        Save
                    </Button>
                    <Button
                        type="button"
                        id="nc-qa-save-start"
                        disabled={busy}
                        onClick={() => void savePatient(true)}
                    >
                        <Play className="h-4 w-4" aria-hidden="true" />
                        Save and Start visit
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        id="nc-qa-cancel"
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
                    modalId="nc-qa-discard-modal"
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
            </Card>
        );
    },
);
