import { describe, expect, it } from 'vitest';
import {
    collectRegistrationSection,
    DEFAULT_REGISTRATION_FORM,
    shouldRunRegistrationDupCheck,
} from './registrationFormModel';

describe('registrationFormModel', () => {
    it('shouldRunRegistrationDupCheck requires meaningful input', () => {
        expect(shouldRunRegistrationDupCheck({
            fname: 'A',
            lname: '',
            phone: '',
            reach_contact_phone: '',
            national_id: '',
        })).toBe(false);
        expect(shouldRunRegistrationDupCheck({
            fname: 'Kw',
            lname: '',
            phone: '',
            reach_contact_phone: '',
            national_id: '',
        })).toBe(true);
    });

    it('collectRegistrationSection trims section 1 identity fields', () => {
        const form = {
            ...DEFAULT_REGISTRATION_FORM,
            fname: '  Ada ',
            lname: 'Mensah',
            sex: 'Female',
            phone: '0241234567',
        };
        expect(collectRegistrationSection(form, 1)).toMatchObject({
            fname: 'Ada',
            lname: 'Mensah',
            sex: 'Female',
            phone: '0241234567',
        });
    });
});
