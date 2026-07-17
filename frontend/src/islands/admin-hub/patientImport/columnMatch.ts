import type { ColumnMapping, ImportField } from './types';

const SYNONYMS: [ImportField, string[]][] = [
  ['fname', ['firstname', 'first', 'givenname', 'given', 'prenom']],
  ['lname', ['lastname', 'last', 'surname', 'familyname', 'family', 'nom']],
  ['mname', ['middlename', 'middle', 'othernames', 'other']],
  ['sex', ['sex', 'gender']],
  ['dob', ['dob', 'dateofbirth', 'birthdate', 'birthday', 'born']],
  ['phone', ['phone', 'phoneno', 'mobile', 'mobileno', 'telephone', 'tel', 'contact', 'contactno', 'cell']],
  ['street', ['address', 'streetaddress', 'street', 'residence', 'location', 'homeaddress']],
  ['old_clinic_number', ['oldclinicnumber', 'oldid', 'cardno', 'cardnumber', 'folderno', 'foldernumber', 'opdno', 'opdnumber', 'hospitalno', 'hospitalnumber', 'patientid', 'patientno', 'recordno', 'mrn']],
  ['national_id', ['nationalid', 'ghanacard', 'ghanacardno', 'idnumber', 'nationalidnumber', 'nid']],
];

function squash(header: string): string {
  return header.toLowerCase().replace(/[^a-z]/g, '');
}

export function autoMatch(headers: string[]): ColumnMapping {
  const used = new Set<ImportField>();

  return headers.map((header) => {
    const key = squash(header);
    for (const [field, names] of SYNONYMS) {
      if (!used.has(field) && names.includes(key)) {
        used.add(field);
        return field;
      }
    }
    return null;
  });
}
