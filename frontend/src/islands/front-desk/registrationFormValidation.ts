/**
 * Field-level validation for registration form
 */
import type { RegistrationFormValues } from './RegistrationFormSections';

export interface FieldValidationError {
    field: keyof RegistrationFormValues;
    message: string;
}

export type ValidationErrors = Partial<Record<keyof RegistrationFormValues, string>>;

/**
 * Validate a single field and return error message if invalid
 */
export function validateField(
    field: keyof RegistrationFormValues,
    value: unknown,
    form: RegistrationFormValues
): string {
    switch (field) {
        // Section 1: Basic Info
        case 'fname':
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.length === 0) return 'First name is required';
                if (trimmed.length < 2) return 'First name must be at least 2 characters';
                if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) return 'First name contains invalid characters';
            }
            return '';

        case 'lname':
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.length === 0) return 'Last name is required';
                if (trimmed.length < 2) return 'Last name must be at least 2 characters';
                if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) return 'Last name contains invalid characters';
            }
            return '';

        case 'mname':
            if (typeof value === 'string' && value.trim().length > 0) {
                if (!/^[a-zA-Z\s'-]+$/.test(value.trim())) return 'Middle name contains invalid characters';
            }
            return '';

        case 'sex':
            if (typeof value === 'string' && value.trim().length === 0) {
                return 'Sex is required';
            }
            return '';

        case 'DOB':
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.length === 0 && form.age_years.trim().length === 0) {
                    return 'Date of birth or estimated age is required';
                }
                if (trimmed.length > 0) {
                    const date = new Date(trimmed);
                    if (isNaN(date.getTime())) return 'Invalid date format';
                    if (date > new Date()) return 'Date of birth cannot be in the future';
                    const age = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                    if (age > 130) return 'Date of birth suggests age over 130 years';
                }
            }
            return '';

        case 'age_years':
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.length === 0 && form.DOB.trim().length === 0) {
                    return 'Date of birth or estimated age is required';
                }
                if (trimmed.length > 0) {
                    const age = Number.parseInt(trimmed, 10);
                    if (isNaN(age)) return 'Age must be a number';
                    if (age < 0) return 'Age cannot be negative';
                    if (age > 130) return 'Age cannot exceed 130 years';
                }
            }
            return '';

        case 'phone':
            if (!form.no_phone && typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.length === 0) return 'Phone number is required (or check "no phone")';
                if (trimmed.length > 0 && trimmed.length < 10) return 'Phone number must be at least 10 digits';
                if (!/^[\d\s+()-]+$/.test(trimmed)) return 'Phone number contains invalid characters';
            }
            return '';

        case 'reach_contact_name':
            if (form.no_phone && typeof value === 'string') {
                if (value.trim().length === 0) return 'Reach contact name is required when patient has no phone';
                if (value.trim().length < 2) return 'Reach contact name must be at least 2 characters';
            }
            return '';

        case 'reach_contact_phone':
            if (form.no_phone && typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.length === 0) return 'Reach contact phone is required when patient has no phone';
                if (trimmed.length < 10) return 'Reach contact phone must be at least 10 digits';
                if (!/^[\d\s+()-]+$/.test(trimmed)) return 'Reach contact phone contains invalid characters';
            }
            return '';

        case 'reach_contact_relationship':
            if (form.no_phone && typeof value === 'string' && value.trim().length === 0) {
                return 'Reach contact relationship is required when patient has no phone';
            }
            return '';

        case 'national_id':
            if (typeof value === 'string' && value.trim().length > 0) {
                const trimmed = value.trim();
                if (trimmed.length < 5) return 'National ID must be at least 5 characters';
                if (!/^[A-Z0-9-]+$/i.test(trimmed)) return 'National ID contains invalid characters';
            }
            return '';

        // Section 2: Contact & Identity
        case 'email':
            if (typeof value === 'string' && value.trim().length > 0) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value.trim())) return 'Invalid email format';
            }
            return '';

        case 'emergency_contact_phone':
            if (typeof value === 'string' && value.trim().length > 0) {
                const trimmed = value.trim();
                if (trimmed.length < 10) return 'Emergency contact phone must be at least 10 digits';
                if (!/^[\d\s+()-]+$/.test(trimmed)) return 'Emergency contact phone contains invalid characters';
            }
            return '';

        case 'phone_home':
            if (typeof value === 'string' && value.trim().length > 0) {
                const trimmed = value.trim();
                if (trimmed.length < 10) return 'Additional phone must be at least 10 digits';
                if (!/^[\d\s+()-]+$/.test(trimmed)) return 'Additional phone contains invalid characters';
            }
            return '';

        // Section 3: Clinical & Demographics
        case 'allergies':
            if (!form.allergies_none_known && !form.allergies_unknown && typeof value === 'string') {
                // Allow optional, but if both checkboxes are unchecked and field is empty, that's OK
                // The server-side validation will catch conflicting states
            }
            return '';

        case 'nhis_number':
            if (form.insurance_type === 'nhis' && typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.length === 0) return 'NHIS number is required for NHIS insurance';
                if (trimmed.length < 5) return 'NHIS number must be at least 5 characters';
            }
            return '';

        case 'nhis_expiry':
            if (form.insurance_type === 'nhis' && typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.length === 0) return 'NHIS expiry date is required';
                const date = new Date(trimmed);
                if (isNaN(date.getTime())) return 'Invalid expiry date';
                // Allow expired NHIS (staff might need to register anyway and note it)
            }
            return '';

        case 'private_insurer':
            if (form.insurance_type === 'private' && typeof value === 'string' && value.trim().length === 0) {
                return 'Private insurer name is required for private insurance';
            }
            return '';

        case 'private_policy':
            if (form.insurance_type === 'private' && typeof value === 'string' && value.trim().length === 0) {
                return 'Policy number is required for private insurance';
            }
            return '';

        default:
            return '';
    }
}

/**
 * Validate all fields in a section and return errors
 */
export function validateSection(section: number, form: RegistrationFormValues): ValidationErrors {
    const errors: ValidationErrors = {};

    const fieldsToValidate: (keyof RegistrationFormValues)[] =
        section === 1
            ? ['fname', 'lname', 'mname', 'sex', 'DOB', 'age_years', 'phone', 'reach_contact_name', 'reach_contact_phone', 'reach_contact_relationship', 'national_id']
            : section === 2
            ? ['email', 'emergency_contact_phone', 'phone_home']
            : section === 3
            ? ['allergies']
            : ['nhis_number', 'nhis_expiry', 'private_insurer', 'private_policy'];

    for (const field of fieldsToValidate) {
        const error = validateField(field, form[field], form);
        if (error) {
            errors[field] = error;
        }
    }

    return errors;
}

/**
 * Check if form has any validation errors
 */
export function hasValidationErrors(errors: ValidationErrors): boolean {
    return Object.keys(errors).length > 0;
}

/**
 * Get a user-friendly summary of validation errors
 */
export function getValidationSummary(errors: ValidationErrors): string {
    const count = Object.keys(errors).length;
    if (count === 0) return '';
    if (count === 1) return '1 field has an error';
    return `${count} fields have errors`;
}
