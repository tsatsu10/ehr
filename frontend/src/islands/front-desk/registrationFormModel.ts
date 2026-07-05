import type { RegistrationFormData } from '@core/types';
import type { RegistrationFormValues } from './RegistrationFormSections';
import { tagsToString } from './registrationFormUtils';

export const DEFAULT_REGISTRATION_FORM: RegistrationFormValues = {
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

export interface RegistrationDupPayload {
    fname: string;
    lname: string;
    sex: string;
    DOB: string;
    age_years: string;
    phone: string;
    no_phone: boolean;
    reach_contact_name: string;
    reach_contact_phone: string;
    national_id: string;
}

export function mapServerToRegistrationForm(data: RegistrationFormData): RegistrationFormValues {
    const section1 = data.section_1 ?? {};
    const section2 = data.section_2 ?? {};
    const section3 = data.section_3 ?? {};
    const section4 = data.section_4 ?? {};

    return {
        ...DEFAULT_REGISTRATION_FORM,
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

export function shouldRunRegistrationDupCheck(payload: {
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

export function collectRegistrationSection(form: RegistrationFormValues, section: number): Record<string, unknown> {
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
