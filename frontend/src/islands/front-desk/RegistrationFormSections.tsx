import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@components/ui/accordion';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Checkbox } from '@components/ui/checkbox';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@components/ui/select';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    BLOOD_GROUPS,
    EDUCATION_LEVELS,
    RACES,
    REACH_RELATIONSHIPS,
    RELIGIONS,
} from './registrationFormConstants';
import { sectionComplete } from './registrationFormUtils';
import type { GeoOption } from './useRegistrationGeo';

export interface RegistrationFormValues {
    fname: string;
    lname: string;
    mname: string;
    sex: string;
    DOB: string;
    age_years: string;
    phone: string;
    no_phone: boolean;
    reach_contact_name: string;
    reach_contact_phone: string;
    reach_contact_relationship: string;
    national_id: string;
    street: string;
    landmark: string;
    nationality: string;
    region_code: string;
    district_code: string;
    place_of_birth: string;
    tribe: string;
    phone_home: string;
    email: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    blood_group: string;
    allergies_none_known: boolean;
    allergies_unknown: boolean;
    allergies: string;
    chronic_conditions: string;
    pregnancy_status: string;
    disability_flag: boolean;
    religion: string;
    race: string;
    education_level: string;
    occupation: string;
    insurance_type: string;
    nhis_number: string;
    nhis_expiry: string;
    private_insurer: string;
    private_policy: string;
    insurance_label: string;
}

interface RegistrationFormSectionsProps {
    form: RegistrationFormValues;
    activeSection: number;
    missingKeys: string[];
    regions: GeoOption[];
    districts: GeoOption[];
    loadingDistricts: boolean;
    wizardMode?: boolean;
    onSectionToggle: (section: number) => void;
    onSaveSection: (section: number) => void;
    onFieldChange: (name: keyof RegistrationFormValues, value: string) => void;
    onCheckboxChange: (name: keyof RegistrationFormValues, checked: boolean) => void;
    onRegionChange: (code: string) => void;
}

const SECTION_TITLES = ['Basic info', 'Contact & identity', 'Clinical & demographics', 'Admin & insurance'] as const;

/** Shared grid wrappers */
function FieldRow({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 }) {
    return (
        <div className={`grid gap-4 ${cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {children}
        </div>
    );
}

function Field({ children, id, label, hint }: { children: React.ReactNode; id: string; label: string; hint?: string }) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            {children}
            {hint && <p className="text-xs text-[var(--oe-nc-text-muted)] leading-relaxed">{hint}</p>}
        </div>
    );
}

function SelectField({
    id, label, value, hint, placeholder, onChange, children,
}: {
    id: string; label: string; value: string; hint?: string; placeholder?: string;
    onChange: (val: string) => void; children: React.ReactNode;
}) {
    return (
        <Field id={id} label={label} hint={hint}>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger id={id}>
                    <SelectValue placeholder={placeholder ?? '—'} />
                </SelectTrigger>
                <SelectContent>
                    {children}
                </SelectContent>
            </Select>
        </Field>
    );
}

function WizardStepBar({
    activeSection,
    stepTitles,
    onPrev,
    onNext,
    nextDisabled = false,
}: {
    activeSection: number;
    stepTitles: readonly string[];
    onPrev: () => void;
    onNext: () => void;
    nextDisabled?: boolean;
}) {
    const total = stepTitles.length;
    return (
        <div className="flex items-center justify-between mb-4" id="nc-reg-wizard-nav">
            <Button variant="outline" size="sm" disabled={activeSection <= 1} onClick={onPrev}>
                <ChevronLeft className="h-4 w-4" />
                Previous
            </Button>
            <span className="text-xs text-[var(--oe-nc-text-muted)] font-medium">
                Step {activeSection} of {total}
                {' — '}
                {stepTitles[activeSection - 1]}
            </span>
            <Button variant="outline" size="sm" disabled={activeSection >= total || nextDisabled} onClick={onNext}>
                Next
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}

interface SectionCardProps {
    section: number;
    title: string;
    complete: boolean;
    onSaveSection: (section: number) => void;
    children: React.ReactNode;
}

function SectionCard({ section, title, complete, onSaveSection, children }: SectionCardProps) {
    return (
        <AccordionItem value={String(section)} className="nc-reg-section border-[var(--oe-nc-border)]">
            <AccordionTrigger id={`nc-reg-heading-${section}`} className="hover:no-underline">
                <span className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--oe-nc-primary)]/10 text-[var(--oe-nc-primary)] text-xs font-bold">
                        {section}
                    </span>
                    <span className="font-semibold text-sm">{title}</span>
                    {complete && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-label="Section complete" />
                    )}
                </span>
            </AccordionTrigger>
            <AccordionContent id={`nc-reg-section-${section}`} className="px-1">
                <div className="space-y-4 pt-1 pb-2">
                    {children}
                    <div className="pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="nc-reg-save-section"
                            onClick={() => onSaveSection(section)}
                        >
                            Save section {section}
                        </Button>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

export function RegistrationFormSections({
    form,
    activeSection,
    missingKeys,
    regions,
    districts,
    loadingDistricts,
    wizardMode = false,
    onSectionToggle,
    onSaveSection,
    onFieldChange,
    onCheckboxChange,
    onRegionChange,
}: RegistrationFormSectionsProps) {
    const showReachContact = form.no_phone;
    const showPregnancy = form.sex === 'Female';
    const showNhis = form.insurance_type === 'nhis';
    const showPrivate = form.insurance_type === 'private';
    const showSection = (section: number) => !wizardMode || activeSection === section;

    return (
        <Accordion
            type="single"
            collapsible={!wizardMode}
            className={`nc-reg-accordion${wizardMode ? ' nc-reg-wizard' : ''}`}
            id="nc-reg-accordion"
            value={String(activeSection)}
            onValueChange={(value) => { if (value) onSectionToggle(Number(value)); }}
        >
            {wizardMode && (
                <WizardStepBar
                    activeSection={activeSection}
                    stepTitles={SECTION_TITLES}
                    onPrev={() => onSectionToggle(Math.max(1, activeSection - 1))}
                    onNext={() => onSectionToggle(Math.min(SECTION_TITLES.length, activeSection + 1))}
                />
            )}

            {/* ──────────────── SECTION 1: Basic info ──────────────── */}
            {showSection(1) && (
                <SectionCard section={1} title="Basic info" complete={sectionComplete(1, missingKeys)} onSaveSection={onSaveSection}>
                    <FieldRow cols={3}>
                        <Field id="nc-reg-fname" label="First name">
                            <Input id="nc-reg-fname" value={form.fname} onChange={(e) => onFieldChange('fname', e.target.value)} />
                        </Field>
                        <Field id="nc-reg-lname" label="Last name">
                            <Input id="nc-reg-lname" value={form.lname} onChange={(e) => onFieldChange('lname', e.target.value)} />
                        </Field>
                        <Field id="nc-reg-mname" label="Middle name">
                            <Input id="nc-reg-mname" value={form.mname} onChange={(e) => onFieldChange('mname', e.target.value)} />
                        </Field>
                    </FieldRow>

                    <FieldRow cols={3}>
                        <SelectField id="nc-reg-sex" label="Sex" value={form.sex} placeholder="Select" onChange={(v) => onFieldChange('sex', v)}>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="UNK">Unknown</SelectItem>
                        </SelectField>
                        <Field id="nc-reg-dob-s1" label="Date of birth">
                            <Input type="date" id="nc-reg-dob-s1" value={form.DOB} onChange={(e) => onFieldChange('DOB', e.target.value)} />
                        </Field>
                        <Field id="nc-reg-age" label="Or estimated age (years)">
                            <Input type="number" min={0} max={130} id="nc-reg-age" value={form.age_years} onChange={(e) => onFieldChange('age_years', e.target.value)} />
                        </Field>
                    </FieldRow>

                    <Field id="nc-reg-phone" label="Personal phone">
                        <Input id="nc-reg-phone" value={form.phone} disabled={form.no_phone} onChange={(e) => onFieldChange('phone', e.target.value)} />
                    </Field>

                    <div className="flex items-center gap-2.5">
                        <Checkbox id="nc-reg-no-phone" checked={form.no_phone} onCheckedChange={(c) => onCheckboxChange('no_phone', c === true)} />
                        <Label htmlFor="nc-reg-no-phone" className="normal-case tracking-normal text-sm font-normal cursor-pointer">
                            Patient has no personal phone
                        </Label>
                    </div>
                    <p className="text-xs text-[var(--oe-nc-text-muted)]">
                        If checked, add who we can call to reach the patient (e.g. neighbour). Emergency contact is separate in Section 2.
                    </p>

                    {showReachContact && (
                        <Card
                            id="nc-reg-reach-contact-wrap"
                            className="border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint)] shadow-none"
                        >
                            <CardContent className="space-y-4 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
                                    Reach contact
                                </p>
                                <FieldRow cols={3}>
                                    <Field id="nc-reg-reach-name" label="Name">
                                        <Input id="nc-reg-reach-name" placeholder="e.g. Kwame (neighbour)" value={form.reach_contact_name} onChange={(e) => onFieldChange('reach_contact_name', e.target.value)} />
                                    </Field>
                                    <Field id="nc-reg-reach-phone" label="Phone">
                                        <Input id="nc-reg-reach-phone" value={form.reach_contact_phone} onChange={(e) => onFieldChange('reach_contact_phone', e.target.value)} />
                                    </Field>
                                    <SelectField id="nc-reg-reach-relationship" label="Relationship" value={form.reach_contact_relationship} onChange={(v) => onFieldChange('reach_contact_relationship', v)}>
                                        {REACH_RELATIONSHIPS.map((item) => (
                                            <SelectItem key={item.value || 'blank'} value={item.value || '_blank'}>{item.label}</SelectItem>
                                        ))}
                                    </SelectField>
                                </FieldRow>
                            </CardContent>
                        </Card>
                    )}

                    <Field id="nc-reg-national-id" label="National ID" hint="Ghana Card or national ID — used for duplicate check at registration.">
                        <Input id="nc-reg-national-id" value={form.national_id} onChange={(e) => onFieldChange('national_id', e.target.value)} />
                    </Field>
                </SectionCard>
            )}

            {/* ──────────────── SECTION 2: Contact & identity ──────────────── */}
            {showSection(2) && (
                <SectionCard section={2} title="Contact & identity" complete={sectionComplete(2, missingKeys)} onSaveSection={onSaveSection}>
                    <Field id="nc-reg-street" label="Address">
                        <Textarea id="nc-reg-street" rows={2} value={form.street} onChange={(e) => onFieldChange('street', e.target.value)} />
                    </Field>

                    <FieldRow cols={3}>
                        <Field id="nc-reg-landmark" label="Landmark">
                            <Input id="nc-reg-landmark" value={form.landmark} onChange={(e) => onFieldChange('landmark', e.target.value)} />
                        </Field>
                        <SelectField id="nc-reg-region" label="Region" value={form.region_code} placeholder="Select region" onChange={onRegionChange}>
                            {regions.map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                        </SelectField>
                        <SelectField id="nc-reg-district" label="District" value={form.district_code} placeholder={loadingDistricts ? 'Loading…' : 'Select district'} onChange={(v) => onFieldChange('district_code', v)}>
                            {districts.map((d) => <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>)}
                        </SelectField>
                    </FieldRow>

                    <FieldRow cols={3}>
                        <Field id="nc-reg-nationality" label="Nationality">
                            <Input id="nc-reg-nationality" placeholder="e.g. Ghanaian" value={form.nationality} onChange={(e) => onFieldChange('nationality', e.target.value)} />
                        </Field>
                        <Field id="nc-reg-place-of-birth" label="Place of birth">
                            <Input id="nc-reg-place-of-birth" value={form.place_of_birth} onChange={(e) => onFieldChange('place_of_birth', e.target.value)} />
                        </Field>
                        <Field id="nc-reg-tribe" label="Tribe" hint="Ethnic or cultural group (e.g. Akan, Ewe).">
                            <Input id="nc-reg-tribe" value={form.tribe} onChange={(e) => onFieldChange('tribe', e.target.value)} />
                        </Field>
                    </FieldRow>

                    <FieldRow cols={2}>
                        <Field id="nc-reg-phone-home" label="Additional phone">
                            <Input id="nc-reg-phone-home" value={form.phone_home} onChange={(e) => onFieldChange('phone_home', e.target.value)} />
                        </Field>
                        <Field id="nc-reg-email" label="Email">
                            <Input type="email" id="nc-reg-email" value={form.email} onChange={(e) => onFieldChange('email', e.target.value)} />
                        </Field>
                    </FieldRow>

                    <p className="text-xs text-[var(--oe-nc-text-muted)]">
                        Emergency contact is for crises and may be a different person than the reach contact in Section 1.
                    </p>
                    <FieldRow cols={2}>
                        <Field id="nc-reg-ec-name" label="Emergency contact name">
                            <Input id="nc-reg-ec-name" value={form.emergency_contact_name} onChange={(e) => onFieldChange('emergency_contact_name', e.target.value)} />
                        </Field>
                        <Field id="nc-reg-ec-phone" label="Emergency contact phone">
                            <Input id="nc-reg-ec-phone" value={form.emergency_contact_phone} onChange={(e) => onFieldChange('emergency_contact_phone', e.target.value)} />
                        </Field>
                    </FieldRow>
                </SectionCard>
            )}

            {/* ──────────────── SECTION 3: Clinical & demographics ──────────────── */}
            {showSection(3) && (
                <SectionCard section={3} title="Clinical & demographics" complete={sectionComplete(3, missingKeys)} onSaveSection={onSaveSection}>
                    <SelectField id="nc-reg-blood" label="Blood group" value={form.blood_group} placeholder="—" onChange={(v) => onFieldChange('blood_group', v)}>
                        {BLOOD_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectField>

                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5">
                            <Checkbox id="nc-reg-nkda" checked={form.allergies_none_known} onCheckedChange={(c) => onCheckboxChange('allergies_none_known', c === true)} />
                            <Label htmlFor="nc-reg-nkda" className="normal-case tracking-normal text-sm font-normal cursor-pointer">None known (NKDA)</Label>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <Checkbox id="nc-reg-allergies-unknown" checked={form.allergies_unknown} onCheckedChange={(c) => onCheckboxChange('allergies_unknown', c === true)} />
                            <Label htmlFor="nc-reg-allergies-unknown" className="normal-case tracking-normal text-sm font-normal cursor-pointer">Allergies unknown (patient unsure)</Label>
                        </div>
                    </div>

                    <Field id="nc-reg-allergies" label="Allergies (comma-separated)">
                        <Input className="min-h-[38px]" id="nc-reg-allergies" disabled={form.allergies_none_known || form.allergies_unknown} value={form.allergies} onChange={(e) => onFieldChange('allergies', e.target.value)} />
                    </Field>

                    <Field id="nc-reg-chronic" label="Chronic conditions (comma-separated)">
                        <Input className="min-h-[38px]" id="nc-reg-chronic" value={form.chronic_conditions} onChange={(e) => onFieldChange('chronic_conditions', e.target.value)} />
                    </Field>

                    {showPregnancy && (
                        <div id="nc-reg-pregnancy-wrap">
                            <SelectField id="nc-reg-pregnancy" label="Pregnancy status" value={form.pregnancy_status} placeholder="—" onChange={(v) => onFieldChange('pregnancy_status', v)}>
                                <SelectItem value="Not pregnant">Not pregnant</SelectItem>
                                <SelectItem value="Pregnant">Pregnant</SelectItem>
                                <SelectItem value="Unknown">Unknown</SelectItem>
                            </SelectField>
                        </div>
                    )}

                    <div className="flex items-center gap-2.5">
                        <Checkbox id="nc-reg-disability" checked={form.disability_flag} onCheckedChange={(c) => onCheckboxChange('disability_flag', c === true)} />
                        <Label htmlFor="nc-reg-disability" className="normal-case tracking-normal text-sm font-normal cursor-pointer">Disability flag</Label>
                    </div>

                    <FieldRow cols={2}>
                        <SelectField id="nc-reg-religion" label="Religion" value={form.religion} placeholder="—" onChange={(v) => onFieldChange('religion', v)}>
                            {RELIGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectField>
                        <SelectField id="nc-reg-race" label="Race" value={form.race} placeholder="—" hint="Self-reported category for reporting; separate from tribe in Section 2." onChange={(v) => onFieldChange('race', v)}>
                            {RACES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectField>
                    </FieldRow>

                    <FieldRow cols={2}>
                        <SelectField id="nc-reg-education-level" label="Highest education level" value={form.education_level} placeholder="—" onChange={(v) => onFieldChange('education_level', v)}>
                            {EDUCATION_LEVELS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                        </SelectField>
                        <Field id="nc-reg-occupation" label="Occupation">
                            <Input id="nc-reg-occupation" value={form.occupation} onChange={(e) => onFieldChange('occupation', e.target.value)} />
                        </Field>
                    </FieldRow>
                </SectionCard>
            )}

            {/* ──────────────── SECTION 4: Admin & insurance ──────────────── */}
            {showSection(4) && (
                <SectionCard section={4} title="Admin & insurance" complete={sectionComplete(4, missingKeys)} onSaveSection={onSaveSection}>
                    <SelectField id="nc-reg-insurance-type" label="Insurance type" value={form.insurance_type} onChange={(v) => onFieldChange('insurance_type', v)}>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="nhis">NHIS</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                    </SelectField>
                    {form.insurance_label && (
                        <p className="text-xs text-[var(--oe-nc-text-muted)]" id="nc-reg-insurance-effective">
                            Effective billing: {form.insurance_label}
                        </p>
                    )}

                    {showNhis && (
                        <div id="nc-reg-nhis-wrap">
                            <FieldRow cols={2}>
                                <Field id="nc-reg-nhis" label="NHIS number">
                                    <Input id="nc-reg-nhis" value={form.nhis_number} onChange={(e) => onFieldChange('nhis_number', e.target.value)} />
                                </Field>
                                <Field id="nc-reg-nhis-expiry" label="NHIS expiry">
                                    <Input type="date" id="nc-reg-nhis-expiry" value={form.nhis_expiry} onChange={(e) => onFieldChange('nhis_expiry', e.target.value)} />
                                </Field>
                            </FieldRow>
                        </div>
                    )}

                    {showPrivate && (
                        <div id="nc-reg-private-wrap">
                            <FieldRow cols={2}>
                                <Field id="nc-reg-private-insurer" label="Private insurer">
                                    <Input id="nc-reg-private-insurer" value={form.private_insurer} onChange={(e) => onFieldChange('private_insurer', e.target.value)} />
                                </Field>
                                <Field id="nc-reg-private-policy" label="Policy number">
                                    <Input id="nc-reg-private-policy" value={form.private_policy} onChange={(e) => onFieldChange('private_policy', e.target.value)} />
                                </Field>
                            </FieldRow>
                        </div>
                    )}
                </SectionCard>
            )}
        </Accordion>
    );
}
