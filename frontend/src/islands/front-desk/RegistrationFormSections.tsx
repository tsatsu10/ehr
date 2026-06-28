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
    onSectionToggle: (section: number) => void;
    onSaveSection: (section: number) => void;
    onFieldChange: (name: keyof RegistrationFormValues, value: string) => void;
    onCheckboxChange: (name: keyof RegistrationFormValues, checked: boolean) => void;
    onRegionChange: (code: string) => void;
}

interface SectionCardProps {
    section: number;
    title: string;
    activeSection: number;
    complete: boolean;
    onSectionToggle: (section: number) => void;
    onSaveSection: (section: number) => void;
    children: React.ReactNode;
}

function SectionCard({
    section,
    title,
    activeSection,
    complete,
    onSectionToggle,
    onSaveSection,
    children,
}: SectionCardProps) {
    const isOpen = activeSection === section;
    return (
        <div className="card mb-2">
            <div
                className="card-header d-flex justify-content-between align-items-center"
                id={`nc-reg-heading-${section}`}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                aria-controls={`nc-reg-section-${section}`}
                onClick={() => onSectionToggle(section)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSectionToggle(section);
                    }
                }}
            >
                <span>Section {section}: {title}</span>
                <span className="nc-section-check ml-2 text-success" aria-hidden="true">
                    {complete ? '✓' : ''}
                </span>
            </div>
            <div
                id={`nc-reg-section-${section}`}
                className={isOpen ? 'mt-0' : 'd-none'}
                aria-labelledby={`nc-reg-heading-${section}`}
            >
                <div className="card-body">
                    {children}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-primary nc-reg-save-section"
                        onClick={() => onSaveSection(section)}
                    >
                        Save section {section}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function RegistrationFormSections({
    form,
    activeSection,
    missingKeys,
    regions,
    districts,
    loadingDistricts,
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

    return (
        <div className="accordion" id="nc-reg-accordion">
            <SectionCard
                section={1}
                title="Basic info"
                activeSection={activeSection}
                complete={sectionComplete(1, missingKeys)}
                onSectionToggle={onSectionToggle}
                onSaveSection={onSaveSection}
            >
                <div className="form-row">
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-fname">First name</label>
                        <input
                            className="form-control"
                            id="nc-reg-fname"
                            value={form.fname}
                            onChange={(e) => onFieldChange('fname', e.target.value)}
                        />
                    </div>
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-lname">Last name</label>
                        <input
                            className="form-control"
                            id="nc-reg-lname"
                            value={form.lname}
                            onChange={(e) => onFieldChange('lname', e.target.value)}
                        />
                    </div>
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-mname">Middle name</label>
                        <input
                            className="form-control"
                            id="nc-reg-mname"
                            value={form.mname}
                            onChange={(e) => onFieldChange('mname', e.target.value)}
                        />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-sex">Sex</label>
                        <select
                            className="form-control"
                            id="nc-reg-sex"
                            value={form.sex}
                            onChange={(e) => onFieldChange('sex', e.target.value)}
                        >
                            <option value="">Select</option>
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="UNK">Unknown</option>
                        </select>
                    </div>
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-dob-s1">Date of birth</label>
                        <input
                            type="date"
                            className="form-control"
                            id="nc-reg-dob-s1"
                            value={form.DOB}
                            onChange={(e) => onFieldChange('DOB', e.target.value)}
                        />
                    </div>
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-age">Or estimated age</label>
                        <input
                            type="number"
                            min={0}
                            max={130}
                            className="form-control"
                            id="nc-reg-age"
                            value={form.age_years}
                            onChange={(e) => onFieldChange('age_years', e.target.value)}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="nc-reg-phone">Personal phone</label>
                    <input
                        className="form-control"
                        id="nc-reg-phone"
                        value={form.phone}
                        disabled={form.no_phone}
                        onChange={(e) => onFieldChange('phone', e.target.value)}
                    />
                </div>
                <div className="form-group form-check">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        id="nc-reg-no-phone"
                        checked={form.no_phone}
                        onChange={(e) => onCheckboxChange('no_phone', e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="nc-reg-no-phone">
                        Patient has no personal phone
                    </label>
                </div>
                <small className="form-text text-muted mb-2">
                    If checked, add who we can call to reach the patient (e.g. neighbour). Emergency
                    contact is separate in Section 2.
                </small>
                <div id="nc-reg-reach-contact-wrap" className={`${showReachContact ? '' : 'd-none '}border rounded p-2 mb-2 bg-light`}>
                    <div className="form-row">
                        <div className="form-group col-md-4">
                            <label htmlFor="nc-reg-reach-name">Reach contact name</label>
                            <input
                                className="form-control"
                                id="nc-reg-reach-name"
                                placeholder="e.g. Kwame (neighbour)"
                                value={form.reach_contact_name}
                                onChange={(e) => onFieldChange('reach_contact_name', e.target.value)}
                            />
                        </div>
                        <div className="form-group col-md-4">
                            <label htmlFor="nc-reg-reach-phone">Reach contact phone</label>
                            <input
                                className="form-control"
                                id="nc-reg-reach-phone"
                                value={form.reach_contact_phone}
                                onChange={(e) => onFieldChange('reach_contact_phone', e.target.value)}
                            />
                        </div>
                        <div className="form-group col-md-4">
                            <label htmlFor="nc-reg-reach-relationship">Relationship</label>
                            <select
                                className="form-control"
                                id="nc-reg-reach-relationship"
                                value={form.reach_contact_relationship}
                                onChange={(e) => onFieldChange('reach_contact_relationship', e.target.value)}
                            >
                                {REACH_RELATIONSHIPS.map((item) => (
                                    <option key={item.value || 'blank'} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="nc-reg-national-id">National ID</label>
                    <input
                        className="form-control"
                        id="nc-reg-national-id"
                        value={form.national_id}
                        onChange={(e) => onFieldChange('national_id', e.target.value)}
                    />
                    <small className="form-text text-muted">
                        Ghana Card or national ID — used for duplicate check at registration.
                    </small>
                </div>
            </SectionCard>

            <SectionCard
                section={2}
                title="Contact & identity"
                activeSection={activeSection}
                complete={sectionComplete(2, missingKeys)}
                onSectionToggle={onSectionToggle}
                onSaveSection={onSaveSection}
            >
                <div className="form-group">
                    <label htmlFor="nc-reg-street">Address</label>
                    <textarea
                        className="form-control"
                        id="nc-reg-street"
                        rows={2}
                        value={form.street}
                        onChange={(e) => onFieldChange('street', e.target.value)}
                    />
                </div>
                <div className="form-row">
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-landmark">Landmark</label>
                        <input
                            className="form-control"
                            id="nc-reg-landmark"
                            value={form.landmark}
                            onChange={(e) => onFieldChange('landmark', e.target.value)}
                        />
                    </div>
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-region">Region</label>
                        <select
                            className="form-control"
                            id="nc-reg-region"
                            value={form.region_code}
                            onChange={(e) => onRegionChange(e.target.value)}
                        >
                            <option value="">Select region</option>
                            {regions.map((region) => (
                                <option key={region.code} value={region.code}>
                                    {region.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-district">District</label>
                        <select
                            className="form-control"
                            id="nc-reg-district"
                            value={form.district_code}
                            disabled={!form.region_code || loadingDistricts}
                            onChange={(e) => onFieldChange('district_code', e.target.value)}
                        >
                            <option value="">Select district</option>
                            {districts.map((district) => (
                                <option key={district.code} value={district.code}>
                                    {district.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-nationality">Nationality</label>
                        <input
                            className="form-control"
                            id="nc-reg-nationality"
                            placeholder="e.g. Ghanaian"
                            value={form.nationality}
                            onChange={(e) => onFieldChange('nationality', e.target.value)}
                        />
                    </div>
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-place-of-birth">Place of birth</label>
                        <input
                            className="form-control"
                            id="nc-reg-place-of-birth"
                            value={form.place_of_birth}
                            onChange={(e) => onFieldChange('place_of_birth', e.target.value)}
                        />
                    </div>
                    <div className="form-group col-md-4">
                        <label htmlFor="nc-reg-tribe">Tribe</label>
                        <input
                            className="form-control"
                            id="nc-reg-tribe"
                            value={form.tribe}
                            onChange={(e) => onFieldChange('tribe', e.target.value)}
                        />
                        <small className="form-text text-muted">
                            Ethnic or cultural group (e.g. Akan, Ewe).
                        </small>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group col-md-6">
                        <label htmlFor="nc-reg-phone-home">Additional phone</label>
                        <input
                            className="form-control"
                            id="nc-reg-phone-home"
                            value={form.phone_home}
                            onChange={(e) => onFieldChange('phone_home', e.target.value)}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="nc-reg-email">Email</label>
                    <input
                        type="email"
                        className="form-control"
                        id="nc-reg-email"
                        value={form.email}
                        onChange={(e) => onFieldChange('email', e.target.value)}
                    />
                </div>
                <p className="text-muted small mb-2">
                    Emergency contact is for crises and may be a different person than the reach contact in Section 1.
                </p>
                <div className="form-row">
                    <div className="form-group col-md-6">
                        <label htmlFor="nc-reg-ec-name">Emergency contact name</label>
                        <input
                            className="form-control"
                            id="nc-reg-ec-name"
                            value={form.emergency_contact_name}
                            onChange={(e) => onFieldChange('emergency_contact_name', e.target.value)}
                        />
                    </div>
                    <div className="form-group col-md-6">
                        <label htmlFor="nc-reg-ec-phone">Emergency contact phone</label>
                        <input
                            className="form-control"
                            id="nc-reg-ec-phone"
                            value={form.emergency_contact_phone}
                            onChange={(e) => onFieldChange('emergency_contact_phone', e.target.value)}
                        />
                    </div>
                </div>
            </SectionCard>

            <SectionCard
                section={3}
                title="Clinical & demographics"
                activeSection={activeSection}
                complete={sectionComplete(3, missingKeys)}
                onSectionToggle={onSectionToggle}
                onSaveSection={onSaveSection}
            >
                <div className="form-group">
                    <label htmlFor="nc-reg-blood">Blood group</label>
                    <select
                        className="form-control"
                        id="nc-reg-blood"
                        value={form.blood_group}
                        onChange={(e) => onFieldChange('blood_group', e.target.value)}
                    >
                        <option value="">—</option>
                        {BLOOD_GROUPS.map((group) => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group form-check">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        id="nc-reg-nkda"
                        checked={form.allergies_none_known}
                        onChange={(e) => onCheckboxChange('allergies_none_known', e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="nc-reg-nkda">
                        None known (NKDA)
                    </label>
                </div>
                <div className="form-group form-check">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        id="nc-reg-allergies-unknown"
                        checked={form.allergies_unknown}
                        onChange={(e) => onCheckboxChange('allergies_unknown', e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="nc-reg-allergies-unknown">
                        Allergies unknown (patient unsure)
                    </label>
                </div>
                <div className="form-group">
                    <label htmlFor="nc-reg-allergies">Allergies (comma-separated)</label>
                    <input
                        className="form-control nc-tag-input"
                        id="nc-reg-allergies"
                        disabled={form.allergies_none_known || form.allergies_unknown}
                        value={form.allergies}
                        onChange={(e) => onFieldChange('allergies', e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="nc-reg-chronic">Chronic conditions (comma-separated)</label>
                    <input
                        className="form-control nc-tag-input"
                        id="nc-reg-chronic"
                        value={form.chronic_conditions}
                        onChange={(e) => onFieldChange('chronic_conditions', e.target.value)}
                    />
                </div>
                <div className={`form-group${showPregnancy ? '' : ' d-none'}`} id="nc-reg-pregnancy-wrap">
                    <label htmlFor="nc-reg-pregnancy">Pregnancy status</label>
                    <select
                        className="form-control"
                        id="nc-reg-pregnancy"
                        value={form.pregnancy_status}
                        onChange={(e) => onFieldChange('pregnancy_status', e.target.value)}
                    >
                        <option value="">—</option>
                        <option value="Not pregnant">Not pregnant</option>
                        <option value="Pregnant">Pregnant</option>
                        <option value="Unknown">Unknown</option>
                    </select>
                </div>
                <div className="form-group form-check">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        id="nc-reg-disability"
                        checked={form.disability_flag}
                        onChange={(e) => onCheckboxChange('disability_flag', e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="nc-reg-disability">
                        Disability flag
                    </label>
                </div>
                <div className="form-row">
                    <div className="form-group col-md-6">
                        <label htmlFor="nc-reg-religion">Religion</label>
                        <select
                            className="form-control"
                            id="nc-reg-religion"
                            value={form.religion}
                            onChange={(e) => onFieldChange('religion', e.target.value)}
                        >
                            <option value="">—</option>
                            {RELIGIONS.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group col-md-6">
                        <label htmlFor="nc-reg-race">Race</label>
                        <select
                            className="form-control"
                            id="nc-reg-race"
                            value={form.race}
                            onChange={(e) => onFieldChange('race', e.target.value)}
                        >
                            <option value="">—</option>
                            {RACES.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                        <small className="form-text text-muted">
                            Self-reported category for reporting; separate from tribe in Section 2.
                        </small>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group col-md-6">
                        <label htmlFor="nc-reg-education-level">Highest education level</label>
                        <select
                            className="form-control"
                            id="nc-reg-education-level"
                            value={form.education_level}
                            onChange={(e) => onFieldChange('education_level', e.target.value)}
                        >
                            <option value="">—</option>
                            {EDUCATION_LEVELS.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group col-md-6">
                        <label htmlFor="nc-reg-occupation">Occupation</label>
                        <input
                            className="form-control"
                            id="nc-reg-occupation"
                            value={form.occupation}
                            onChange={(e) => onFieldChange('occupation', e.target.value)}
                        />
                    </div>
                </div>
            </SectionCard>

            <SectionCard
                section={4}
                title="Admin & insurance"
                activeSection={activeSection}
                complete={sectionComplete(4, missingKeys)}
                onSectionToggle={onSectionToggle}
                onSaveSection={onSaveSection}
            >
                <div className="form-group">
                    <label htmlFor="nc-reg-insurance-type">Insurance type</label>
                    <select
                        className="form-control"
                        id="nc-reg-insurance-type"
                        value={form.insurance_type}
                        onChange={(e) => onFieldChange('insurance_type', e.target.value)}
                    >
                        <option value="cash">Cash</option>
                        <option value="nhis">NHIS</option>
                        <option value="private">Private</option>
                    </select>
                    <small className="form-text text-muted" id="nc-reg-insurance-effective">
                        {form.insurance_label ? `Effective billing: ${form.insurance_label}` : ''}
                    </small>
                </div>
                <div id="nc-reg-nhis-wrap" className={showNhis ? '' : 'd-none'}>
                    <div className="form-row">
                        <div className="form-group col-md-6">
                            <label htmlFor="nc-reg-nhis">NHIS number</label>
                            <input
                                className="form-control"
                                id="nc-reg-nhis"
                                value={form.nhis_number}
                                onChange={(e) => onFieldChange('nhis_number', e.target.value)}
                            />
                        </div>
                        <div className="form-group col-md-6">
                            <label htmlFor="nc-reg-nhis-expiry">NHIS expiry</label>
                            <input
                                type="date"
                                className="form-control"
                                id="nc-reg-nhis-expiry"
                                value={form.nhis_expiry}
                                onChange={(e) => onFieldChange('nhis_expiry', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div id="nc-reg-private-wrap" className={showPrivate ? '' : 'd-none'}>
                    <div className="form-row">
                        <div className="form-group col-md-6">
                            <label htmlFor="nc-reg-private-insurer">Private insurer</label>
                            <input
                                className="form-control"
                                id="nc-reg-private-insurer"
                                value={form.private_insurer}
                                onChange={(e) => onFieldChange('private_insurer', e.target.value)}
                            />
                        </div>
                        <div className="form-group col-md-6">
                            <label htmlFor="nc-reg-private-policy">Policy number</label>
                            <input
                                className="form-control"
                                id="nc-reg-private-policy"
                                value={form.private_policy}
                                onChange={(e) => onFieldChange('private_policy', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
